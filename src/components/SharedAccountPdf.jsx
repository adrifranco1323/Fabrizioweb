import { forwardRef } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas-pro'

const money = value => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = value => `${value >= 0 ? '+' : '-'} $ ${money(Math.abs(value))}`

export async function exportElementToPdf(element, fileName) {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgHeight = (canvas.height * pageWidth) / canvas.width

  let heightLeft = imgHeight
  pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight)
  heightLeft -= pageHeight
  while (heightLeft > 0) {
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, heightLeft - imgHeight, pageWidth, imgHeight)
    heightLeft -= pageHeight
  }
  pdf.save(fileName)
}

// Plantilla blanca oculta, usada solo para generar el PDF de una cuenta compartida
const SharedAccountPdfTemplate = forwardRef(function SharedAccountPdfTemplate(
  { account, statement, nameOf, providerName, startDate, endDate }, ref,
) {
  const cards = [
    ['Opening Balance', statement.openingBalanceUSD, 'text-slate-700'],
    ['Income for the Period', statement.totalIncomeUSD, 'text-emerald-600'],
    ['Expenses for the Period', -statement.totalExpenseUSD, 'text-rose-600'],
    ['Net Balance', statement.netPeriodBalanceUSD, statement.netPeriodBalanceUSD >= 0 ? 'text-amber-600' : 'text-rose-600'],
    ['Accumulated Balance', statement.accumulatedBalanceUSD, statement.accumulatedBalanceUSD >= 0 ? 'text-cyan-600' : 'text-rose-600'],
  ]
  const th = 'py-2.5 px-4'

  return (
    <div className="fixed top-0 pointer-events-none" style={{ left: '-9999px' }}>
      <div ref={ref} className="bg-white text-slate-900 w-200">
        <div className="p-8 border-b-2 border-emerald-600 flex items-center gap-5">
          <img src="/fae-logo.png" alt="FAE Property Solutions" className="h-20 w-20 object-contain" />
          <div>
            <h1 className="text-2xl font-bold">FAE Property Solutions</h1>
            <p className="text-lg font-semibold">Account Statement: {account.name}</p>
            <p className="text-sm text-slate-500">Properties: {account.propertyIds.map(nameOf).join(' + ')}</p>
            <p className="text-sm text-slate-500">Period: {startDate} to {endDate}</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-bold text-emerald-700">Income / Contributions</h3>
            </div>
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr><th className={th}>Date</th><th className={th}>Source</th><th className={th}>Description</th><th className={th}>Amount ($ USD)</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {statement.periodIncomes.map(income => (
                  <tr key={income.id}>
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-500">{income.date || 'N/A'}</td>
                    <td className="py-2.5 px-4 text-slate-600">{income.accountId ? 'Shared account' : nameOf(income.propertyId)}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{income.description}</td>
                    <td className="py-2.5 px-4 font-bold text-emerald-700">+ $ {money(income.amountUSD)}</td>
                  </tr>
                ))}
                {statement.periodIncomes.length === 0 && (
                  <tr><td colSpan={4} className="py-4 px-4 text-center text-slate-400">No deposits for this period.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={3} className="py-2.5 px-4 font-bold text-slate-700 text-right">Total Income</td>
                  <td className="py-2.5 px-4 font-black text-emerald-700">+ $ {money(statement.totalIncomeUSD)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-bold text-rose-700">Expenses &amp; Services</h3>
            </div>
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr><th className={th}>Date</th><th className={th}>Details</th><th className={th}>Vendor</th><th className={th}>Amount ($ USD)</th></tr>
              </thead>
              {statement.expensesByProperty.map(group => (
                <tbody key={group.propertyId} className="divide-y divide-slate-200">
                  <tr className="bg-slate-50">
                    <td colSpan={3} className="py-2 px-4 font-bold text-slate-800">{nameOf(group.propertyId)}</td>
                    <td className="py-2 px-4 font-bold text-rose-700">- $ {money(group.totalUSD)}</td>
                  </tr>
                  {group.items.map(expense => (
                    <tr key={expense.id}>
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-500">{expense.date || 'N/A'}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{expense.description}</td>
                      <td className="py-2.5 px-4 text-slate-600">{providerName(expense.providerId)}</td>
                      <td className="py-2.5 px-4 font-bold text-rose-700">- $ {money(expense.amountUSD)}</td>
                    </tr>
                  ))}
                  {group.items.length === 0 && (
                    <tr><td colSpan={4} className="py-3 px-4 text-center text-slate-400">No expenses for this period.</td></tr>
                  )}
                </tbody>
              ))}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={3} className="py-2.5 px-4 font-bold text-slate-700 text-right">Total Expenses</td>
                  <td className="py-2.5 px-4 font-black text-rose-700">- $ {money(statement.totalExpenseUSD)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="grid grid-cols-5 gap-3">
            {cards.map(([label, value, color]) => (
              <div key={label} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                <div className="flex h-8 items-center justify-center text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-2">{label}</div>
                <div className={`text-base font-black whitespace-nowrap ${color}`}>{signed(value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})

export default SharedAccountPdfTemplate
