import React from 'react';
import { api } from '../../utils/api';
import { showToast } from '../../utils/toast';

export default function ScorecardPane({
  applicationId,
  questions, setQuestions,
  scorecard, setScorecard,
  summaryText, setSummaryText,
  savingQuestions, setSavingQuestions,
  summarizing, setSummarizing,
  scoring, setScoring,
}) {
  return (
    <div className="rounded-xl border bg-white p-3 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Questions</div>
        <div className="flex gap-2">
          <button
            className="rounded border px-3 py-1 text-sm"
            onClick={() => setQuestions((q)=>[...q, { id: String(Date.now()), text: '', weight: 1, category: '' }])}
          >Add</button>
          <button
            className="rounded bg-gray-900 text-white px-3 py-1 text-sm disabled:opacity-50"
            disabled={savingQuestions}
            onClick={async ()=>{
              setSavingQuestions(true);
              try {
                const payload = { questions: (questions||[]).map((x,i)=>({ id: x.id||String(i+1), text: x.text||'', weight: Number(x.weight)||1, category: x.category||'' })) };
                await api.post(`/interview/${applicationId}/questions`, payload);
                showToast({ title: 'Saved', message: 'Questions updated' });
              } catch (e) {
                showToast({ title: 'Save failed', message: e?.response?.data?.error || 'Try again' });
              } finally { setSavingQuestions(false); }
            }}
          >Save</button>
        </div>
      </div>

      <div className="space-y-2">
        {(questions||[]).map((q, idx) => (
          <div key={q.id||idx} className="grid gap-2 sm:grid-cols-12 items-center">
            <input value={q.text||''} onChange={(e)=>setQuestions((arr)=>arr.map((x,i)=>i===idx?{...x, text:e.target.value}:x))} placeholder="Question text" className="sm:col-span-7 rounded border px-2 py-1 text-sm" />
            <input value={q.category||''} onChange={(e)=>setQuestions((arr)=>arr.map((x,i)=>i===idx?{...x, category:e.target.value}:x))} placeholder="Category" className="sm:col-span-3 rounded border px-2 py-1 text-sm" />
            <input value={q.weight||1} type="number" min={1} max={5} onChange={(e)=>setQuestions((arr)=>arr.map((x,i)=>i===idx?{...x, weight:Number(e.target.value)||1}:x))} placeholder="Weight" className="sm:col-span-1 rounded border px-2 py-1 text-sm" />
            <button onClick={()=>setQuestions((arr)=>arr.filter((_,i)=>i!==idx))} className="sm:col-span-1 text-sm underline">Remove</button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={async ()=>{
            try {
              setSummarizing(true);
              const res = await api.post(`/interview/${applicationId}/summarize`);
              if (res?.data?.summaryText) setSummaryText(res.data.summaryText);
            } catch (e) { showToast({ title: 'Summarize failed', message: e?.response?.data?.error || 'Try again' }); }
            finally { setSummarizing(false); }
          }}
        >{summarizing? 'Summarizing…':'Generate summary'}</button>
        <button
          className="rounded bg-gray-900 text-white px-3 py-1 text-sm disabled:opacity-50"
          disabled={scoring}
          onClick={async ()=>{
            try {
              setScoring(true);
              const res = await api.post(`/interview/${applicationId}/scorecard`, {});
              if (res?.data?.scorecard) setScorecard(res.data.scorecard);
            } catch (e) { showToast({ title: 'Scorecard failed', message: e?.response?.data?.error || 'Try again' }); }
            finally { setScoring(false); }
          }}
        >{scoring? 'Scoring…':'Generate scorecard'}</button>

        <button
          className="ml-auto rounded border px-3 py-1 text-sm"
          onClick={()=>{
            try {
              const rows = [
                ['QuestionId','Criterion','Score','Rationale'],
                ...((scorecard?.criteria||[]).map(c=>[c.questionId||'', c.criterion||'', String(c.score??''), (c.rationale||'').replace(/\n/g,' ')]))
              ];
              const csv = rows.map(r=>r.map((v)=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `scorecard-${applicationId}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            } catch {}
          }}
        >Export CSV</button>
        <button
          className="rounded border px-3 py-1 text-sm"
          onClick={()=>{
            const w = window.open('', '_blank');
            if (!w) return;
            const html = `<!doctype html><html><head><meta charset="utf-8"><title>Scorecard</title></head><body>
              <h3>Interview Scorecard</h3>
              <div><strong>Overall:</strong> ${scorecard?.overallScore ?? ''}</div>
              <pre style="white-space:pre-wrap;font-family:inherit;">${(scorecard?.summary||'').replace(/</g,'&lt;')}</pre>
              <table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>QuestionId</th><th>Criterion</th><th>Score</th><th>Rationale</th></tr></thead>
              <tbody>
                ${(scorecard?.criteria||[]).map(c=>`<tr><td>${c.questionId||''}</td><td>${(c.criterion||'').replace(/</g,'&lt;')}</td><td>${c.score??''}</td><td>${(c.rationale||'').replace(/</g,'&lt;')}</td></tr>`).join('')}
              </tbody></table>
              <script>window.onload=()=>window.print()</script>
            </body></html>`;
            w.document.write(html); w.document.close();
          }}
        >Export PDF</button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border p-3">
          <div className="text-sm font-semibold mb-1">Summary</div>
          <div className="text-sm whitespace-pre-wrap min-h-[120px]">{summaryText || '—'}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-sm font-semibold mb-1">Overall score</div>
          <div className="text-2xl font-bold">{scorecard?.overallScore ?? '—'}</div>
        </div>
      </div>

      <div className="rounded border p-3 overflow-auto">
        <div className="text-sm font-semibold mb-2">Criteria</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="border-b py-1 pr-2">QuestionId</th>
              <th className="border-b py-1 pr-2">Criterion</th>
              <th className="border-b py-1 pr-2">Score</th>
              <th className="border-b py-1 pr-2">Rationale</th>
            </tr>
          </thead>
          <tbody>
            {(scorecard?.criteria||[]).map((c,i)=> (
              <tr key={i} className="align-top">
                <td className="border-b py-1 pr-2 font-mono text-xs">{c.questionId||''}</td>
                <td className="border-b py-1 pr-2">{c.criterion||''}</td>
                <td className="border-b py-1 pr-2">{String(c.score ?? '')}</td>
                <td className="border-b py-1 pr-2 whitespace-pre-wrap">{c.rationale||''}</td>
              </tr>
            ))}
            {(!scorecard?.criteria || scorecard.criteria.length===0) && (
              <tr><td colSpan={4} className="py-2 text-gray-500">No scorecard yet. Add questions and click Generate.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
