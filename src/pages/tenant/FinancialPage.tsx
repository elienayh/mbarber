import React, { useState } from "react";
import { DollarSign, ArrowDownRight, ArrowUpRight, Plus, Filter, Wallet, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export const FinancialPage: React.FC = () => {
  const [transactions, setTransactions] = useState([
    {
      id: "t1",
      date: "05/09/2026",
      type: "income",
      category: "Atendimento",
      description: "Corte Degradê - Rodrigo Almeida",
      barber: "João Silva",
      method: "PIX",
      amount_cents: 4500,
    },
    {
      id: "t2",
      date: "05/09/2026",
      type: "income",
      category: "Produto",
      description: "Venda de Pomada Matte Extra Forte",
      barber: "Carlos Barbeiro",
      method: "Cartão de Crédito",
      amount_cents: 6500,
    },
    {
      id: "t3",
      date: "05/09/2026",
      type: "expense",
      category: "Comissão",
      description: "Comissão de Atendimento - João Silva",
      barber: "João Silva",
      method: "PIX",
      amount_cents: 2250,
    },
    {
      id: "t4",
      date: "04/09/2026",
      type: "expense",
      category: "Insumos",
      description: "Compra de Lâminas e Toalhas Descartáveis",
      barber: "Geral",
      method: "Boleto",
      amount_cents: 18000,
    },
    {
      id: "t5",
      date: "01/09/2026",
      type: "expense",
      category: "Aluguel",
      description: "Aluguel do Ponto Comercial (Setembro)",
      barber: "Geral",
      method: "Transferência",
      amount_cents: 250000,
    },
  ]);

  const summary = {
    grossRevenue: 1485000, // R$ 14.850,00
    commissions: 668250,   // R$ 6.682,50
    expenses: 395000,      // R$ 3.950,00
    netProfit: 421750,     // R$ 4.217,50
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">Financeiro da Barbearia</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Fluxo de caixa, receitas de serviços/produtos, despesas e repasse de comissões
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm transition flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Nova Despesa / Entrada</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Faturamento Bruto (Mês)</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatCurrency(summary.grossRevenue)}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            +18% em relação ao mês anterior
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Comissões de Barbeiros</div>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {formatCurrency(summary.commissions)}
          </div>
          <div className="text-xs text-slate-400 mt-1">50% de média contratual</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-400 uppercase">Despesas Operacionais</div>
          <div className="text-2xl font-black text-red-600 mt-1">
            {formatCurrency(summary.expenses)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Aluguel, luz, água e insumos</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm bg-gradient-to-br from-white to-amber-50/50">
          <div className="text-xs font-semibold text-amber-700 uppercase">Lucro Líquido da Barbearia</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatCurrency(summary.netProfit)}
          </div>
          <div className="text-xs text-emerald-700 font-semibold mt-1">Margem Líquida de 28,4%</div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base">Últimos Lançamentos do Livro Caixa</h3>
          <span className="text-xs text-slate-400 font-medium">Filtrado por: Todos os lançamentos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-xs border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Data</th>
                <th className="py-3.5 px-4">Descrição</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Forma de Pagamento</th>
                <th className="py-3.5 px-4">Barbeiro</th>
                <th className="py-3.5 px-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 text-xs font-medium text-slate-500">{tx.date}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{tx.description}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {tx.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">{tx.method}</td>
                  <td className="py-3.5 px-4 text-xs text-slate-600">{tx.barber}</td>
                  <td
                    className={`py-3.5 px-4 text-right font-bold ${
                      tx.type === "income" ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {tx.type === "income" ? "+" : "-"} {formatCurrency(tx.amount_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
