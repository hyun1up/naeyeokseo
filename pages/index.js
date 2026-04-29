import { useState, useRef } from 'react'
import Head from 'next/head'

export default function Home() {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [items, setItems] = useState([])
  const [ilwiDaega, setIlwiDaega] = useState([])
  const [guide, setGuide] = useState('')
  const [activeTab, setActiveTab] = useState('naeyeok')
  const [pdfFile, setPdfFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  function onDrop(e) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.type === 'application/pdf') setPdfFile(f)
  }

  async function analyze() {
    if (!description.trim()) { alert('공사 내용을 입력해주세요.'); return }
    setLoading(true)
    setItems([]); setIlwiDaega([]); setGuide('')
    try {
      const fd = new FormData()
      fd.append('description', description)
      if (pdfFile) fd.append('pdf', pdfFile)
      const res = await fetch('/api/analyze', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTitle(data.title || description.slice(0, 30))
      setItems((data.items || []).map((it, i) => ({ ...it, id: i })))
      setIlwiDaega(data.ilwiDaega || [])
      setGuide(data.guide || '')
      setActiveTab('naeyeok')
    } catch (e) { alert('오류: ' + e.message) }
    setLoading(false)
  }

  function updateQty(i, v) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, qty: parseFloat(v) || 0 } : it))
  }

  function getAmt(it) {
    const mat = Math.round((it.qty || 0) * (it.matPrice || 0))
    const lab = Math.round((it.qty || 0) * (it.labPrice || 0))
    const exp = Math.round((it.qty || 0) * (it.expPrice || 0))
    return { mat, lab, exp, total: mat + lab + exp }
  }

  function downloadExcel() {
    if (!items.length) { alert('내역서 항목이 없습니다.'); return }
    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new()
      const naeyeokRows = [
        ['품명','규격','단위','수량','재료비단가','재료비금액','노무비단가','노무비금액','경비단가','경비금액','합계단가','합계금액','비고'],
        ...items.map(it => {
          const a = getAmt(it)
          return [it.name,it.spec||'',it.unit||'',it.qty||0,it.matPrice||0,a.mat,it.labPrice||0,a.lab,it.expPrice||0,a.exp,(it.matPrice||0)+(it.labPrice||0)+(it.expPrice||0),a.total,it.note||'']
        }),
        ['합계','','','','',items.reduce((s,it)=>s+getAmt(it).mat,0),'',items.reduce((s,it)=>s+getAmt(it).lab,0),'',items.reduce((s,it)=>s+getAmt(it).exp,0),'',items.reduce((s,it)=>s+getAmt(it).total,0),'']
      ]
      const ws1 = XLSX.utils.aoa_to_sheet(naeyeokRows)
      ws1['!cols'] = [18,14,6,8,10,12,10,12,10,12,10,12,12].map(w=>({wch:w}))
      XLSX.utils.book_append_sheet(wb, ws1, '내역서')
      const ilwiRows = []
      ilwiDaega.forEach((iw,idx) => {
        if(idx>0) ilwiRows.push([])
        ilwiRows.push([`${iw.title}  ${iw.spec||''}  (${iw.unit||''})`, ...Array(12).fill('')])
        ilwiRows.push(['품명','규격','단위','수량','재료비단가','재료비금액','노무비단가','노무비금액','경비단가','경비금액','합계단가','합계금액','비고'])
        let tm=0,tl=0,te=0
        iw.rows.forEach(r => {
          const mat=Math.round((r.qty||0)*(r.matPrice||0)),lab=Math.round((r.qty||0)*(r.labPrice||0)),exp=Math.round((r.qty||0)*(r.expPrice||0))
          tm+=mat;tl+=lab;te+=exp
          ilwiRows.push([r.name,r.spec||'',r.unit||'',r.qty||0,r.matPrice||0,mat,r.labPrice||0,lab,r.expPrice||0,exp,(r.matPrice||0)+(r.labPrice||0)+(r.expPrice||0),mat+lab+exp,r.note||''])
        })
        ilwiRows.push(['[ 합계 ]','','','','',tm,'',tl,'',te,'',tm+tl+te,''])
      })
      const ws2 = XLSX.utils.aoa_to_sheet(ilwiRows)
      ws2['!cols'] = [20,16,6,8,10,12,10,12,10,12,10,12,12].map(w=>({wch:w}))
      XLSX.utils.book_append_sheet(wb, ws2, '일위대가')
      XLSX.writeFile(wb, `내역서_${title}_${new Date().toISOString().slice(0,10)}.xlsx`)
    })
  }

  const totMat=items.reduce((s,it)=>s+getAmt(it).mat,0)
  const totLab=items.reduce((s,it)=>s+getAmt(it).lab,0)
  const totExp=items.reduce((s,it)=>s+getAmt(it).exp,0)
  const totAll=totMat+totLab+totExp

  return (
    <>
      <Head>
        <title>공사 내역서 생성기</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet" />
      </Head>
      <div className="container">
        <header>
          <div className="header-inner">
            <div>
              <h1>공사 내역서 생성기</h1>
              <p className="subtitle">표준품셈 PDF 업로드 → 공사 내용 입력 → AI가 내역서 + 일위대가 자동 생성</p>
            </div>
            <span className="badge">AI 적산</span>
          </div>
        </header>
        <main>
          <section className="card">
            <div className="step-label"><span className="step-num">1</span><span>표준품셈 PDF 업로드 (선택)</span></div>
            <div
              className={`drop-zone ${dragging?'drag':''} ${pdfFile?'has-file':''}`}
              onDragOver={e=>{e.preventDefault();setDragging(true)}}
              onDragLeave={()=>setDragging(false)}
              onDrop={onDrop}
              onClick={()=>fileRef.current.click()}
            >
              {pdfFile ? (
                <div className="file-info">
                  <span>📄</span>
                  <span className="file-name">{pdfFile.name}</span>
                  <button className="remove-btn" onClick={e=>{e.stopPropagation();setPdfFile(null)}}>✕ 제거</button>
                </div>
              ) : (
                <>
                  <div className="drop-icon">📄</div>
                  <div className="drop-label">2026년 건설공사 표준품셈 PDF를 여기에 드래그하거나 클릭</div>
                  <div className="drop-sub">PDF 업로드 시 표준품셈 기준으로 정확한 내역서 작성</div>
                </>
              )}
            </div>
            <input type="file" accept=".pdf" ref={fileRef} style={{display:'none'}} onChange={e=>e.target.files[0]&&setPdfFile(e.target.files[0])} />
          </section>

          <section className="card">
            <div className="step-label"><span className="step-num">2</span><span>어떤 공사인지 설명해주세요</span></div>
            <textarea value={description} onChange={e=>setDescription(e.target.value)}
              placeholder={"예: 아파트 주차장 바닥 균열 보수 공사\n예: 오수관로 D300 PE관 63m 교체\n예: 용접식 난간 설치 10m"} rows={4} />
            <div className="btn-row">
              <button className="btn btn-primary" onClick={analyze} disabled={loading}>
                {loading?'분석 중...':'AI 분석 시작 →'}
              </button>
              <button className="btn" onClick={()=>setDescription('용접식 난간 설치 10m, 오수관로 D300 PE관 50m 교체')}>예시 입력</button>
            </div>
            {loading && <div className="status"><div className="spinner"/><span>{pdfFile?'표준품셈 PDF를 읽고 내역서 작성 중...':'AI가 내역서와 일위대가를 작성하는 중...'}</span></div>}
          </section>

          {items.length > 0 && (
            <section className="card">
              <div className="tab-header">
                <div className="tabs">
                  <button className={`tab ${activeTab==='naeyeok'?'active':''}`} onClick={()=>setActiveTab('naeyeok')}>내역서</button>
                  {ilwiDaega.length>0&&<button className={`tab ${activeTab==='ilwi'?'active':''}`} onClick={()=>setActiveTab('ilwi')}>일위대가 ({ilwiDaega.length})</button>}
                  {guide&&<button className={`tab ${activeTab==='guide'?'active':''}`} onClick={()=>setActiveTab('guide')}>시공 가이드</button>}
                </div>
                <button className="btn btn-primary" onClick={downloadExcel}>엑셀 다운로드 →</button>
              </div>

              {activeTab==='naeyeok'&&(
                <>
                  <div className="table-title" style={{margin:'12px 0 10px'}}>{title}</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{width:36}}>번호</th>
                          <th rowSpan={2}>품목명</th>
                          <th rowSpan={2} style={{width:80}}>규격</th>
                          <th rowSpan={2} style={{width:46}}>단위</th>
                          <th rowSpan={2} style={{width:72,textAlign:'right'}}>수량</th>
                          <th colSpan={2} style={{textAlign:'center',borderLeft:'1px solid #eee'}}>재료비</th>
                          <th colSpan={2} style={{textAlign:'center',borderLeft:'1px solid #eee'}}>노무비</th>
                          <th colSpan={2} style={{textAlign:'center',borderLeft:'1px solid #eee'}}>경비</th>
                          <th colSpan={2} style={{textAlign:'center',borderLeft:'1px solid #eee'}}>합계</th>
                          <th rowSpan={2} style={{width:70}}>비고</th>
                        </tr>
                        <tr>
                          {['단가','금액','단가','금액','단가','금액','단가','금액'].map((h,i)=>(
                            <th key={i} style={{textAlign:'right',width:80,borderLeft:i%2===0?'1px solid #eee':undefined}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it,i)=>{
                          const a=getAmt(it)
                          return (
                            <tr key={i}>
                              <td className="muted">{i+1}</td>
                              <td className="bold">{it.name}</td>
                              <td className="muted small">{it.spec}</td>
                              <td>{it.unit}</td>
                              <td style={{textAlign:'right'}}>
                                <input type="number" className="qty-input" value={it.qty} min={0} step={0.1} onChange={e=>updateQty(i,e.target.value)}/>
                              </td>
                              <td style={{textAlign:'right',borderLeft:'1px solid #f0eeea'}}>{(it.matPrice||0).toLocaleString()}</td>
                              <td style={{textAlign:'right'}}>{a.mat.toLocaleString()}</td>
                              <td style={{textAlign:'right',borderLeft:'1px solid #f0eeea'}}>{(it.labPrice||0).toLocaleString()}</td>
                              <td style={{textAlign:'right'}}>{a.lab.toLocaleString()}</td>
                              <td style={{textAlign:'right',borderLeft:'1px solid #f0eeea'}}>{(it.expPrice||0).toLocaleString()}</td>
                              <td style={{textAlign:'right'}}>{a.exp.toLocaleString()}</td>
                              <td style={{textAlign:'right',borderLeft:'1px solid #f0eeea'}}>{((it.matPrice||0)+(it.labPrice||0)+(it.expPrice||0)).toLocaleString()}</td>
                              <td style={{textAlign:'right'}}>{a.total.toLocaleString()}</td>
                              <td className="muted small">{it.note}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={5} style={{textAlign:'right',fontWeight:500}}>합 계</td>
                          <td style={{borderLeft:'1px solid #ddd'}}></td><td style={{textAlign:'right',fontWeight:700}}>{totMat.toLocaleString()}</td>
                          <td style={{borderLeft:'1px solid #ddd'}}></td><td style={{textAlign:'right',fontWeight:700}}>{totLab.toLocaleString()}</td>
                          <td style={{borderLeft:'1px solid #ddd'}}></td><td style={{textAlign:'right',fontWeight:700}}>{totExp.toLocaleString()}</td>
                          <td style={{borderLeft:'1px solid #ddd'}}></td><td style={{textAlign:'right',fontWeight:700}}>{totAll.toLocaleString()}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="summary-grid">
                    <div className="metric"><div className="metric-label">재료비</div><div className="metric-val">{totMat.toLocaleString()}원</div></div>
                    <div className="metric"><div className="metric-label">노무비</div><div className="metric-val">{totLab.toLocaleString()}원</div></div>
                    <div className="metric"><div className="metric-label">경비</div><div className="metric-val">{totExp.toLocaleString()}원</div></div>
                    <div className="metric" style={{gridColumn:'1/-1',background:'#1a1a1a',color:'#fff'}}>
                      <div className="metric-label" style={{color:'#aaa'}}>총 합계</div>
                      <div className="metric-val">{totAll.toLocaleString()}원</div>
                    </div>
                  </div>
                </>
              )}

              {activeTab==='ilwi'&&(
                <div style={{marginTop:12}}>
                  {ilwiDaega.map((iw,idx)=>{
                    let im=0,il=0,ie=0
                    iw.rows.forEach(r=>{im+=Math.round((r.qty||0)*(r.matPrice||0));il+=Math.round((r.qty||0)*(r.labPrice||0));ie+=Math.round((r.qty||0)*(r.expPrice||0))})
                    return (
                      <div key={idx} style={{marginBottom:24}}>
                        <div className="ilwi-title">{iw.title} <span className="muted small">{iw.spec} / {iw.unit}</span></div>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>품명</th><th style={{width:100}}>규격</th><th style={{width:46}}>단위</th><th style={{width:60,textAlign:'right'}}>수량</th>
                                <th style={{width:80,textAlign:'right',borderLeft:'1px solid #eee'}}>재료비단가</th><th style={{width:80,textAlign:'right'}}>재료비금액</th>
                                <th style={{width:80,textAlign:'right',borderLeft:'1px solid #eee'}}>노무비단가</th><th style={{width:80,textAlign:'right'}}>노무비금액</th>
                                <th style={{width:70,textAlign:'right',borderLeft:'1px solid #eee'}}>경비단가</th><th style={{width:70,textAlign:'right'}}>경비금액</th>
                                <th style={{width:80,textAlign:'right',borderLeft:'1px solid #eee'}}>합계단가</th><th style={{width:80,textAlign:'right'}}>합계금액</th>
                                <th style={{width:80}}>비고</th>
                              </tr>
                            </thead>
                            <tbody>
                              {iw.rows.map((r,ri)=>{
                                const mat=Math.round((r.qty||0)*(r.matPrice||0)),lab=Math.round((r.qty||0)*(r.labPrice||0)),exp=Math.round((r.qty||0)*(r.expPrice||0))
                                return (
                                  <tr key={ri}>
                                    <td className="bold">{r.name}</td><td className="muted small">{r.spec}</td><td>{r.unit}</td><td style={{textAlign:'right'}}>{r.qty}</td>
                                    <td style={{textAlign:'right',borderLeft:'1px solid #f0eeea'}}>{(r.matPrice||0).toLocaleString()}</td><td style={{textAlign:'right'}}>{mat.toLocaleString()}</td>
                                    <td style={{textAlign:'right',borderLeft:'1px solid #f0eeea'}}>{(r.labPrice||0).toLocaleString()}</td><td style={{textAlign:'right'}}>{lab.toLocaleString()}</td>
                                    <td style={{textAlign:'right',borderLeft:'1px solid #f0eeea'}}>{(r.expPrice||0).toLocaleString()}</td><td style={{textAlign:'right'}}>{exp.toLocaleString()}</td>
                                    <td style={{textAlign:'right',borderLeft:'1px solid #f0eeea'}}>{((r.matPrice||0)+(r.labPrice||0)+(r.expPrice||0)).toLocaleString()}</td><td style={{textAlign:'right'}}>{(mat+lab+exp).toLocaleString()}</td>
                                    <td className="muted small">{r.note}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan={4} style={{textAlign:'right',fontWeight:500}}>[ 합계 ]</td>
                                <td style={{borderLeft:'1px solid #ddd'}}></td><td style={{textAlign:'right',fontWeight:700}}>{im.toLocaleString()}</td>
                                <td style={{borderLeft:'1px solid #ddd'}}></td><td style={{textAlign:'right',fontWeight:700}}>{il.toLocaleString()}</td>
                                <td style={{borderLeft:'1px solid #ddd'}}></td><td style={{textAlign:'right',fontWeight:700}}>{ie.toLocaleString()}</td>
                                <td style={{borderLeft:'1px solid #ddd'}}></td><td style={{textAlign:'right',fontWeight:700}}>{(im+il+ie).toLocaleString()}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {activeTab==='guide'&&(
                <div className="guide" style={{marginTop:12}}><p>{guide}</p></div>
              )}
            </section>
          )}
        </main>
      </div>

      <style jsx global>{`
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans KR',sans-serif;background:#f4f3ef;color:#1a1a1a;min-height:100vh}
        .container{max-width:1100px;margin:0 auto;padding:2rem 1rem}
        header{margin-bottom:1.5rem}
        .header-inner{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}
        h1{font-size:22px;font-weight:700}
        .subtitle{font-size:14px;color:#666;margin-top:4px}
        .badge{background:#1a1a1a;color:#f4f3ef;font-size:12px;padding:4px 12px;border-radius:20px;white-space:nowrap}
        .card{background:#fff;border-radius:12px;padding:1.5rem;margin-bottom:1rem;border:1px solid #e8e6e0}
        .step-label{display:flex;align-items:center;gap:10px;margin-bottom:14px;font-size:15px;font-weight:500}
        .step-num{width:26px;height:26px;border-radius:50%;background:#1a1a1a;color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0}
        .drop-zone{border:2px dashed #ccc;border-radius:10px;padding:2rem 1rem;text-align:center;cursor:pointer;transition:all .15s;background:#fafaf8}
        .drop-zone:hover,.drop-zone.drag{border-color:#1a1a1a;background:#f4f3ef}
        .drop-zone.has-file{border-color:#2d6a2d;background:#f0f7f0;border-style:solid}
        .drop-icon{font-size:28px;margin-bottom:8px}
        .drop-label{font-size:14px;font-weight:500;margin-bottom:4px}
        .drop-sub{font-size:12px;color:#888}
        .file-info{display:flex;align-items:center;gap:10px;justify-content:center}
        .file-name{font-weight:500;font-size:14px;color:#2d6a2d}
        .remove-btn{background:none;border:1px solid #ccc;border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px;color:#888}
        .remove-btn:hover{background:#fee;color:#c00;border-color:#c00}
        textarea{width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-family:'Noto Sans KR',sans-serif;font-size:14px;resize:vertical;line-height:1.6}
        textarea:focus{outline:none;border-color:#1a1a1a}
        .btn-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
        .btn{padding:9px 18px;border:1px solid #ccc;border-radius:8px;font-size:14px;cursor:pointer;background:#fff;font-family:'Noto Sans KR',sans-serif;transition:background .1s}
        .btn:hover{background:#f4f3ef}
        .btn:disabled{opacity:.5;cursor:not-allowed}
        .btn-primary{background:#1a1a1a;color:#fff;border-color:#1a1a1a}
        .btn-primary:hover{background:#333}
        .status{display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 14px;background:#f4f3ef;border-radius:8px;font-size:13px;color:#555}
        .spinner{width:14px;height:14px;border:2px solid #ddd;border-top:2px solid #1a1a1a;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        .tab-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;border-bottom:1px solid #eee;padding-bottom:12px}
        .tabs{display:flex;gap:4px}
        .tab{padding:7px 16px;border:1px solid #ddd;border-radius:8px;font-size:14px;cursor:pointer;background:#fff;font-family:'Noto Sans KR',sans-serif}
        .tab.active{background:#1a1a1a;color:#fff;border-color:#1a1a1a}
        .table-title{font-size:15px;font-weight:700}
        .ilwi-title{font-size:14px;font-weight:700;margin-bottom:8px;padding:8px 12px;background:#f4f3ef;border-radius:6px}
        .table-wrap{overflow-x:auto}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{text-align:left;padding:7px 8px;font-size:11px;font-weight:500;color:#555;border-bottom:1px solid #ddd;background:#fafaf8;white-space:nowrap}
        td{padding:7px 8px;border-bottom:1px solid #f0eeea;vertical-align:middle;white-space:nowrap}
        tfoot td{background:#f4f3ef;border-top:1px solid #ddd;padding:8px}
        tr:hover td{background:#fafaf8}
        .muted{color:#888}
        .small{font-size:11px}
        .bold{font-weight:500}
        .qty-input{width:64px;text-align:right;font-size:12px;padding:3px 5px;border-radius:5px;border:1px solid #ddd;font-family:'Noto Sans KR',sans-serif}
        .qty-input:focus{outline:none;border-color:#1a1a1a}
        .summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
        .metric{background:#f4f3ef;border-radius:8px;padding:12px 14px}
        .metric-label{font-size:12px;color:#888;margin-bottom:4px}
        .metric-val{font-size:16px;font-weight:700}
        .guide p{font-size:14px;color:#444;line-height:1.9;white-space:pre-wrap}
        @media(max-width:600px){
          .summary-grid{grid-template-columns:1fr 1fr}
          .header-inner{flex-direction:column}
          .tab-header{flex-direction:column;align-items:flex-start}
        }
      `}</style>
    </>
  )
}
