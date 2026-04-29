export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { description } = req.body
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
- items: 공종별 내역서 항목
- ilwiDaega: 주요 공종별 일위대가 (표준품셈 형식, 공구손료·잡재료비 등 포함)
- 단가는 2025~2026년 기준 시중 단가로 추정
- 노무비는 2026년 노임단가 기준 (용접공 282536, 철공 239808, 보통인부 172068 등)
- 공구손료 및 경장비: 인력품의 2%
- 잡재료비: 인력품의 2%`

  try {
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
        messages: [{ role: 'user', content: `다음 공사의 내역서와 일위대가를 작성해주세요:\n${description}` }],
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
}
