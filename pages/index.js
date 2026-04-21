import { useState } from 'react'
import Head from 'next/head'

export default function Home() {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [title, setTitle] = useState('')
  const [items, setItems] = useState([])
  const [guide, setGuide] = useState('')

  async function analyze() {
    if (!description.trim()) { alert('공사 내용을 입력해주세요.'); return }
    setLoading(true)
    setStatusText('AI가 공종과 자재를 분석하는 중...')
    setItems([])
    setGuide('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTitle(data.title || description.slice(0, 30))
      setItems((data.items || []).map((it, i) => ({ ...it, id: i, qty: 1 })))
      setGuide(data.guide || '')
    } catch (e) {
      alert('오류: ' + e.message)
    }
    setLoading(false)
  }

  function updateQty(i, v) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: parseFloat(v) || 0 } : it))
  }

  function addRow() {
    setItems(prev => [...prev, { id: prev.length, name: '새 항목', spec: '', unit: '식', type: '재료', unitPrice: 0, qty: 1 }])
  }

  function downloadExcel() {
    if (!items.length) { alert('내역서 항목이 없습니다.'); return }
    import('xlsx').then(XLSX => {
      const total = items.reduce((s, it) => s + Math.round(it.qty * it.unitPrice), 0)
      const rows = [
        ['번호', '품목명', '규격', '단위', '구분', '수량', '단가(원)', '금액(원)'],
        ...items.map((it, i) => [i + 1, it.name, it.spec || '', it.unit || '', it.type, it.qty, it.unitPrice, Math.round(it.qty * it.unitPrice)]),
        ['', '', '', '', '', '', '합계', total],
      ]
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [6, 24, 14, 8, 8, 10, 14, 14].map(w => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 30))
      XLSX.writeFile(wb, `내역서_${title}_${new Date().toISOString().slice(0, 10)}.xlsx`)
    })
  }

  const total = items.reduce((s, it) => s + Math.round(it.qty * it.unitPrice), 0)
  const mat = items.filter(it => it.type === '재료').reduce((s, it) => s + Math.round(it.qty * it.unitPrice), 0)
  const lab = items.filter(it => it.type === '노무').reduce((s, it) => s + Math.round(it.qty * it.unitPrice), 0)
  const mac = items.filter(it => it.type === '기계').reduce((s, it) => s + Math.round(it.qty * it.unitPrice), 0)

  return (
    <>
      <Head>
        <title>공사 내역서 생성기</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet" />
      </Head>

      <div className="container">
        <header>
          <div className="header-inner">
            <div>
              <h1>공사 내역서 생성기</h1>
              <p className="subtitle">공사 내용을 입력하면 AI가 공종·자재·단가를 자동으로 추천해드려요</p>
            </div>
            <span className="badge">AI 적산</span>
          </div>
        </header>

        <main>
          {/* 입력 */}
          <section className="card">
            <div className="step-label">
              <span className="step-num">1</span>
              <span>어떤 공사인지 설명해주세요</span>
            </div>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={"예: 아파트 주차장 바닥 균열 보수 공사\n예: 오수관로 D300 PE관 63m 교체\n예: 보도블럭 재포장 180m2"}
              rows={4}
            />
            <div className="btn-row">
              <button className="btn btn-primary" onClick={analyze} disabled={loading}>
                {loading ? '분석 중...' : 'AI 분석 시작 →'}
              </button>
              <button className="btn" onClick={() => setDescription('오수관로 D300 PE관 63m 보수 교체 공사, 보도블럭 재포장 포함')}>
                예시 입력
              </button>
            </div>
            {loading && (
              <div className="status">
                <div className="spinner" />
                <span>{statusText}</span>
              </div>
            )}
          </section>

          {/* 내역서 */}
          {items.length > 0 && (
            <section className="card">
              <div className="step-label">
                <span className="step-num green">2</span>
                <span>수량 확인 및 조정</span>
              </div>

              <div className="table-header">
                <h2 className="table-title">{title}</h2>
                <div className="btn-row">
                  <button className="btn" onClick={addRow}>+ 행 추가</button>
                  <button className="btn btn-primary" onClick={downloadExcel}>엑셀 다운로드 →</button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>번호</th>
                      <th>품목명</th>
                      <th style={{ width: 90 }}>규격</th>
                      <th style={{ width: 50 }}>단위</th>
                      <th style={{ width: 58 }}>구분</th>
                      <th style={{ width: 80, textAlign: 'right' }}>수량</th>
                      <th style={{ width: 100, textAlign: 'right' }}>단가(원)</th>
                      <th style={{ width: 110, textAlign: 'right' }}>금액(원)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={it.id}>
                        <td className="muted">{i + 1}</td>
                        <td className="bold">{it.name}</td>
                        <td className="muted small">{it.spec}</td>
                        <td>{it.unit}</td>
                        <td><span className={`tag tag-${it.type}`}>{it.type}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            className="qty-input"
                            value={it.qty}
                            min={0}
                            step={0.1}
                            onChange={e => updateQty(i, e.target.value)}
                          />
                        </td>
                        <td style={{ textAlign: 'right' }}>{it.unitPrice.toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>{Math.round(it.qty * it.unitPrice).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'right', fontWeight: 500 }}>합 계</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{total.toLocaleString()} 원</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="summary-grid">
                <div className="metric"><div className="metric-label">재료비</div><div className="metric-val">{mat.toLocaleString()}원</div></div>
                <div className="metric"><div className="metric-label">노무비</div><div className="metric-val">{lab.toLocaleString()}원</div></div>
                <div className="metric"><div className="metric-label">기계경비</div><div className="metric-val">{mac.toLocaleString()}원</div></div>
              </div>

              {guide && (
                <div className="guide">
                  <div className="guide-title">AI 시공 가이드</div>
                  <p>{guide}</p>
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Noto Sans KR', sans-serif; background: #f4f3ef; color: #1a1a1a; min-height: 100vh; }
        .container { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
        header { margin-bottom: 1.5rem; }
        .header-inner { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
        h1 { font-size: 22px; font-weight: 700; }
        .subtitle { font-size: 14px; color: #666; margin-top: 4px; }
        .badge { background: #1a1a1a; color: #f4f3ef; font-size: 12px; padding: 4px 12px; border-radius: 20px; white-space: nowrap; }
        .card { background: #fff; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid #e8e6e0; }
        .step-label { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; font-size: 15px; font-weight: 500; }
        .step-num { width: 26px; height: 26px; border-radius: 50%; background: #1a1a1a; color: #fff; font-size: 13px; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        .step-num.green { background: #2d6a2d; }
        textarea { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-family: 'Noto Sans KR', sans-serif; font-size: 14px; resize: vertical; line-height: 1.6; }
        textarea:focus { outline: none; border-color: #1a1a1a; }
        .btn-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
        .btn { padding: 9px 18px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px; cursor: pointer; background: #fff; font-family: 'Noto Sans KR', sans-serif; transition: background .1s; }
        .btn:hover { background: #f4f3ef; }
        .btn:disabled { opacity: .5; cursor: not-allowed; }
        .btn-primary { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
        .btn-primary:hover { background: #333; }
        .status { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 10px 14px; background: #f4f3ef; border-radius: 8px; font-size: 13px; color: #555; }
        .spinner { width: 14px; height: 14px; border: 2px solid #ddd; border-top: 2px solid #1a1a1a; border-radius: 50%; animation: spin .8s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .table-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .table-title { font-size: 16px; font-weight: 700; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
        th { text-align: left; padding: 8px 10px; font-size: 12px; font-weight: 500; color: #666; border-bottom: 1px solid #eee; background: #fafaf8; }
        td { padding: 8px 10px; border-bottom: 1px solid #f0eeea; vertical-align: middle; }
        tfoot td { background: #f4f3ef; border-top: 1px solid #ddd; padding: 10px; }
        tr:hover td { background: #fafaf8; }
        .muted { color: #888; }
        .small { font-size: 12px; }
        .bold { font-weight: 500; }
        .tag { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
        .tag-재료 { background: #e8f0fd; color: #1a4a8a; }
        .tag-노무 { background: #e8f5e8; color: #1a5c1a; }
        .tag-기계 { background: #fef3e2; color: #7a4a00; }
        .qty-input { width: 68px; text-align: right; font-size: 13px; padding: 4px 6px; border-radius: 6px; border: 1px solid #ddd; font-family: 'Noto Sans KR', sans-serif; }
        .qty-input:focus { outline: none; border-color: #1a1a1a; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
        .metric { background: #f4f3ef; border-radius: 8px; padding: 12px 14px; }
        .metric-label { font-size: 12px; color: #888; margin-bottom: 4px; }
        .metric-val { font-size: 17px; font-weight: 700; }
        .guide { margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee; }
        .guide-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
        .guide p { font-size: 13px; color: #555; line-height: 1.8; white-space: pre-wrap; }
        @media (max-width: 600px) {
          .summary-grid { grid-template-columns: 1fr 1fr; }
          .header-inner { flex-direction: column; }
        }
      `}</style>
    </>
  )
}
