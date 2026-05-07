import formidable from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const form = formidable({ maxFileSize: 30 * 1024 * 1024 })

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: '파일 파싱 오류: ' + err.message })

    const description = Array.isArray(fields.description) ? fields.description[0] : fields.description
    if (!description) return res.status(400).json({ error: '공사 내용을 입력해주세요.' })

    const system = `당신은 대한민국 건설공사 적산 전문가입니다.

[중요 지시사항]
1. 첨부된 표준품셈 PDF에서 공사 내용에 해당하는 품번을 반드시 찾으세요.
2. 찾은 품번의 직종명, 인원수량, 단위를 PDF에 나온 그대로 사용하세요. 수치를 임의로 만들지 마세요.
3. 품번을 못 찾은 항목은 note에 "표준품셈 해당항목 없음(추정)"이라고 표시하세요.
4. 일위대가 rows에는 PDF의 직종명(내장공, 보통인부 등)과 수량을 그대로 기재하세요.
5. 비고란에 품번을 반드시 기재하세요. 예: 건축3-2-3

JSON만 반환. 마크다운 코드블록 없이 순수 JSON만 출력.

{
  "title": "공사명",
  "items": [
    {
      "name": "품목명",
      "spec": "규격",
      "unit": "단위",
      "qty": 숫자,
      "matPrice": 재료비단가,
      "labPrice": 노무비단가,
      "expPrice": 경비단가,
      "note": "표준품셈 품번 예: 건축3-2-3"
    }
  ],
  "ilwiDaega": [
    {
      "title": "일위대가명",
      "poomBun": "품번 예: 건축 3-2-3",
      "spec": "규격",
      "unit": "단위",
      "rows": [
        {
          "name": "직종명 예: 내장공",
          "spec": "예: 소규모할증 적용",
          "unit": "인",
          "qty": 0.018,
          "matPrice": 0,
          "labPrice": 노임단가숫자,
          "expPrice": 0,
          "note": "2026년 노임"
        }
      ]
    }
  ],
  "guide": "시공 순서 및 주의사항 3~5줄"
}

- 노임단가 PDF 첨부시 해당 직종 노임단가 그대로 사용
- 공구손료 및 경장비: 인력품의 2% (별도 행 추가)
- 잡재료비: 인력품의 2% (별도 행 추가)`

    try {
      const messageContent = []
      const pdfFile = files.pdf ? (Array.isArray(files.pdf) ? files.pdf[0] : files.pdf) : null
      const noimFile = files.noim ? (Array.isArray(files.noim) ? files.noim[0] : files.noim) : null

      if (pdfFile) {
        const buf = fs.readFileSync(pdfFile.filepath)
        messageContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') }, title: '표준품셈 PDF' })
      }
      if (noimFile) {
        const buf = fs.readFileSync(noimFile.filepath)
        messageContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') }, title: '노임단가 PDF' })
      }

      const uploadedDocs = [pdfFile && '표준품셈 PDF', noimFile && '노임단가 PDF'].filter(Boolean).join(', ')
      messageContent.push({
        type: 'text',
        text: `다음 공사 내용을 분석하여 표준품셈 품번을 찾고 내역서와 일위대가를 작성하세요${uploadedDocs ? `. 첨부된 ${uploadedDocs}에서 해당 품번을 찾아 수치를 그대로 사용하세요` : ''}:\n\n${description}`
      })

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system,
          messages: [{ role: 'user', content: messageContent }],
        }),
      })

      const data = await response.json()
      if (data.error) return res.status(500).json({ error: data.error.message })
      const raw = data.content.map(c => c.text || '').join('')
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      res.status(200).json(parsed)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
}
