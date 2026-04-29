import formidable from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const form = formidable({ maxFileSize: 20 * 1024 * 1024 })

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: '파일 파싱 오류: ' + err.message })

    const description = Array.isArray(fields.description) ? fields.description[0] : fields.description
    if (!description) return res.status(400).json({ error: '공사 내용을 입력해주세요.' })

    const system = `당신은 대한민국 건설공사 적산 전문가입니다. 표준품셈 기준으로 내역서와 일위대가를 작성합니다.
사용자가 공사 내용을 설명하면 JSON만 반환하세요. 마크다운 코드블록 없이 순수 JSON만 출력하세요.

출력 형식:
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
      "note": "비고"
    }
  ],
  "ilwiDaega": [
    {
      "title": "일위대가 항목명",
      "spec": "규격",
      "unit": "단위",
      "rows": [
        {
          "name": "품명",
          "spec": "규격",
          "unit": "단위",
          "qty": 숫자,
          "matPrice": 재료비단가,
          "labPrice": 노무비단가,
          "expPrice": 경비단가,
          "note": "비고"
        }
      ]
    }
  ],
  "guide": "시공 순서 및 주의사항 3~5줄"
}

규칙:
- PDF가 첨부된 경우 반드시 해당 표준품셈 PDF의 내용을 기준으로 단가와 품목을 작성할 것
- PDF가 없는 경우 2025~2026년 기준 시중 단가로 추정
- 노무비는 2026년 노임단가 기준 (용접공 282536, 철공 239808, 보통인부 172068 등)
- 공구손료 및 경장비: 인력품의 2%
- 잡재료비: 인력품의 2%
- items: 공종별 내역서 항목
- ilwiDaega: 주요 공종별 일위대가 (표준품셈 형식)`

    try {
      // PDF 파일 있으면 base64로 변환
      let messageContent = []
      const pdfFile = files.pdf ? (Array.isArray(files.pdf) ? files.pdf[0] : files.pdf) : null

      if (pdfFile) {
        const pdfBuffer = fs.readFileSync(pdfFile.filepath)
        const pdfBase64 = pdfBuffer.toString('base64')
        messageContent.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
        })
      }

      messageContent.push({
        type: 'text',
        text: `다음 공사의 내역서와 일위대가를 작성해주세요${pdfFile ? ' (첨부된 표준품셈 PDF를 반드시 참고하세요)' : ''}:\n${description}`
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
