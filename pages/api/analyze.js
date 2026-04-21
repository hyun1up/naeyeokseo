export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { description } = req.body
  if (!description) return res.status(400).json({ error: '공사 내용을 입력해주세요.' })

  const system = `당신은 대한민국 건설공사 적산 전문가입니다.
사용자가 공사 내용을 설명하면, 필요한 공종별 품목을 JSON으로만 반환하세요.
마크다운 코드블록 없이 순수 JSON만 출력하세요.

출력 형식:
{
  "title": "공사명",
  "items": [
    {"name":"품목명","spec":"규격","unit":"단위","type":"재료|노무|기계","unitPrice":숫자}
  ],
  "guide": "시공 순서 및 주의사항을 3~5줄로 설명. 처음 하는 사람도 이해할 수 있게."
}

규칙:
- 재료비(자재), 노무비(인건비), 기계경비를 모두 포함
- 단가는 2024~2025년 기준 시중 단가로 추정
- 표준품셈 기준에 맞게 작성`

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
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: `다음 공사의 내역서를 작성해주세요:\n${description}` }],
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
