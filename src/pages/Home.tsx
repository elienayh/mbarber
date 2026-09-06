import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Scissors,
  Calendar,
  Clock,
  Users,
  DollarSign,
  Package,
  MessageSquare,
  Check,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Smartphone,
  ShieldCheck,
  Star,
  Menu,
  X,
  Sparkles,
  Phone,
  UserCheck,
  ExternalLink,
} from "lucide-react";

export const Home: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqItems = [
    {
      question: "O cliente precisa baixar algum aplicativo para agendar?",
      answer:
        "Não! O cliente acessa diretamente pelo link exclusivo da sua barbearia no navegador do celular (ex: mbarber.com.br/sua-barbearia). Não é necessário baixar nenhum app na App Store ou Google Play, nem criar cadastros demorados com senhas.",
    },
    {
      question: "Como o cliente agenda o horário?",
      answer:
        "O processo é feito em um chat conversacional rápido de 45 segundos: o cliente escolhe o serviço desejado, o barbeiro de sua preferência (ou o primeiro disponível), seleciona a data e horário livre, informa seu WhatsApp e recebe a confirmação instantânea com código da reserva.",
    },
    {
      question: "Como o barbeiro e a equipe controlam a agenda?",
      answer:
        "Através do painel do MBarber acessível por qualquer celular, tablet ou computador. A agenda é dividida em colunas por profissional, atualizada em tempo real com os status de cada atendimento (agendado, confirmado, em cadeira e concluído).",
    },
    {
      question: "O sistema evita que dois clientes marquem no mesmo horário?",
      answer:
        "Sim, 100%! O cálculo de disponibilidade é automático e instantâneo. Assim que um horário é reservado para um barbeiro, ele desaparece imediatamente das opções dos demais clientes, eliminando qualquer risco de horário duplo.",
    },
    {
      question: "Como funciona a divisão de comissões e o controle financeiro?",
      answer:
        "Cada barbeiro pode ter sua própria porcentagem de comissão cadastrada. Ao concluir um atendimento na agenda, a receita e o valor da comissão são computados automaticamente no livro-caixa, separando serviços de produtos vendidos.",
    },
    {
      question: "Posso cadastrar produtos de revenda e consumo da bancada?",
      answer:
        "Sim! O MBarber possui módulo integrado de estoque para cadastrar pomadas, óleos, shampoos e insumos, com acompanhamento de quantidades e alertas quando o estoque atinge o nível mínimo.",
    },
  ];

  return (
    <div className="landing-page min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* ========================================================================= */}
      {/* 1. HEADER MINIMALISTA & RESPONSIVO */}
      {/* ========================================================================= */}
      <header className="border-b border-stone-800/80 bg-stone-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-xl shadow-md shadow-amber-500/20 group-hover:scale-105 transition">
              <Scissors className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-white font-display">
                MBarber
              </span>
              <span className="text-[10px] uppercase tracking-widest text-amber-500 font-semibold -mt-1">
                Agendamento & Gestão
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-300">
            <a href="#como-funciona" className="hover:text-amber-400 transition">
              Como Funciona
            </a>
            <a href="#para-barbeiros" className="hover:text-amber-400 transition">
              Para Barbeiros
            </a>
            <a href="#recursos" className="hover:text-amber-400 transition">
              Recursos
            </a>
            <a href="#duvidas" className="hover:text-amber-400 transition">
              Dúvidas
            </a>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/auth/login"
              className="text-sm font-semibold text-stone-300 hover:text-white px-3 py-2 transition"
            >
              Entrar
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-stone-300 hover:text-white hover:bg-stone-900 transition"
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b border-stone-800 bg-stone-900/95 backdrop-blur-xl px-5 py-4 space-y-3">
            <a
              href="#como-funciona"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-200 hover:text-amber-400 py-1"
            >
              Como Funciona
            </a>
            <a
              href="#para-barbeiros"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-200 hover:text-amber-400 py-1"
            >
              Para Barbeiros
            </a>
            <a
              href="#recursos"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-200 hover:text-amber-400 py-1"
            >
              Recursos
            </a>
            <a
              href="#duvidas"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm font-medium text-stone-200 hover:text-amber-400 py-1"
            >
              Dúvidas
            </a>
            <div className="pt-3 border-t border-stone-800 flex flex-col gap-2">
              <Link
                to="/auth/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-2 text-sm font-semibold text-stone-300 hover:text-white"
              >
                Entrar
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION COMERCIAL DE ALTO IMPACTO */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-stone-900">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-amber-500/5 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-10">
            {/* Top pill badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-900 border border-stone-800 text-xs font-semibold text-amber-400 mb-6 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Agendamento inteligente para barbearias modernas</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] mb-6 font-display">
              Seu horário. <br className="hidden sm:inline" />
              Sua barbearia. <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600">
                Do seu jeito.
              </span>
            </h1>

            {/* Subhead */}
            <p className="text-stone-400 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
              O cliente agenda em menos de 1 minuto pelo celular sem precisar baixar aplicativo.
              O barbeiro mantém a rotina, a equipe e o caixa organizados em um único lugar.
            </p>

            {/* Dual CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-10">
              <Link
                to="/vintage-barber"
                className="w-full sm:w-auto px-7 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-sm sm:text-base transition shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 group"
              >
                <span>Agendar um Horário</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Micro value props */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-stone-400">
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-amber-400" />
                <span>Sem baixar aplicativo</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-amber-400" />
                <span>Link exclusivo da barbearia</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-amber-400" />
                <span>Zero risco de horário duplo</span>
              </div>
            </div>
          </div>

          {/* Visual Showcase Card: Modern Barbershop Presence */}
          <div className="mt-8 max-w-5xl mx-auto rounded-3xl p-3 sm:p-5 bg-gradient-to-b from-stone-900/90 to-stone-950 border border-stone-800/90 shadow-2xl">
            <div className="relative rounded-2xl overflow-hidden bg-stone-950 border border-stone-800">
              {/* Top mockup bar */}
              <div className="h-10 bg-stone-900/90 border-b border-stone-800 px-4 flex items-center justify-between text-xs text-stone-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500/50" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500/50" />
                  <span className="ml-2 font-mono text-[11px] text-stone-500">
                    mbarber.com.br/vintage-barber
                  </span>
                </div>
                <div className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Agendamentos Abertos</span>
                </div>
              </div>

              {/* Showcase Grid inside mockup */}
              <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <div className="text-xs font-bold text-amber-500 tracking-wider uppercase">
                    Experiência em 45 segundos
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight font-display">
                    Seus clientes agendam direto pelo link do WhatsApp ou Instagram.
                  </h3>
                  <p className="text-stone-400 text-sm leading-relaxed">
                    Chega de responder dezenas de mensagens perguntando quem tem vaga. O cliente
                    escolhe o corte, vê os horários livres reais do barbeiro e confirma na hora.
                  </p>
                  <div className="pt-2 flex flex-wrap gap-3">
                    <Link
                      to="/vintage-barber"
                      className="px-5 py-2.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs hover:bg-amber-400 transition flex items-center gap-1.5"
                    >
                      <span>Simular Agendamento do Cliente</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      to="/agenda"
                      className="px-5 py-2.5 rounded-xl bg-stone-800 text-stone-200 font-semibold text-xs hover:bg-stone-700 transition flex items-center gap-1.5"
                    >
                      <span>Ver Agenda do Barbeiro</span>
                    </Link>
                  </div>
                </div>

                {/* Mini Preview Box */}
                <div className="lg:col-span-5 bg-stone-900 rounded-2xl p-4 border border-stone-800 space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-stone-800">
                    <span className="text-stone-400 font-medium">Próximo na Cadeira</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                      Confirmado
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm">
                      RA
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">Rodrigo Almeida</div>
                      <div className="text-xs text-stone-400">Corte Degradê + Barboterapia</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded-lg bg-stone-950/70 border border-stone-800/80">
                      <div className="text-stone-500 text-[10px] uppercase font-semibold">Horário</div>
                      <div className="text-stone-200 font-bold">Hoje às 10:30</div>
                    </div>
                    <div className="p-2 rounded-lg bg-stone-950/70 border border-stone-800/80">
                      <div className="text-stone-500 text-[10px] uppercase font-semibold">Barbeiro</div>
                      <div className="text-stone-200 font-bold">João Silva</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SEÇÃO EXPERIÊNCIA DO CLIENTE (O CHAT CONVERSACIONAL) */}
      {/* ========================================================================= */}
      <section id="como-funciona" className="py-20 border-b border-stone-900 bg-stone-950 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">
              Para o Cliente Final
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-2 mb-4 font-display">
              Agendar é simples. Direto pelo link, sem complicação.
            </h2>
            <p className="text-stone-400 text-sm sm:text-base">
              O cliente abre o link exclusivo da sua barbearia no celular e escolhe tudo em uma
              conversa guiada e amigável.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* 4-Step Visual Flow Cards */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-5 rounded-2xl bg-stone-900/80 border border-stone-800/90 hover:border-amber-500/40 transition">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-black flex items-center justify-center text-sm shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Acesse o link da barbearia</h3>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Disponibilizado na bio do Instagram ou enviado diretamente pelo WhatsApp. Sem
                      instalar aplicativo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-stone-900/80 border border-stone-800/90 hover:border-amber-500/40 transition">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-black flex items-center justify-center text-sm shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Escolha o serviço</h3>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Corte tradicional, degradê, barba com toalha quente ou combos completos com
                      preço e duração visíveis.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-stone-900/80 border border-stone-800/90 hover:border-amber-500/40 transition">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-black flex items-center justify-center text-sm shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">
                      Selecione o barbeiro e o melhor horário
                    </h3>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Escolha seu barbeiro favorito ou a opção "qualquer disponível" para encaixe
                      rápido nos horários livres calculados em tempo real.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-stone-900/80 border border-stone-800/90 hover:border-amber-500/40 transition">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 font-black flex items-center justify-center text-sm shrink-0">
                    4
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Confirmação instantânea</h3>
                    <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                      Geração imediata do código de reserva, resumo com dia/hora e opção de salvar no
                      Google Agenda.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mockup do Chat Conversacional (Representação fiel do sistema real) */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-sm rounded-[36px] p-3 bg-stone-900 border-2 border-stone-800 shadow-2xl relative">
                {/* Speaker pill */}
                <div className="w-24 h-4 bg-stone-950 rounded-full mx-auto mb-3" />

                {/* Chat Screen Container */}
                <div className="bg-stone-950 rounded-[28px] p-4 border border-stone-800/80 space-y-3.5 text-xs">
                  {/* Chat Top Header */}
                  <div className="flex items-center gap-2.5 pb-3 border-b border-stone-800">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-stone-950 font-bold flex items-center justify-center text-xs">
                      MB
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">Barbearia Vintage Club</div>
                      <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Agendamento Online Aberto
                      </div>
                    </div>
                  </div>

                  {/* Message 1: Barbearia */}
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center text-[10px] font-bold shrink-0">
                      ✂️
                    </div>
                    <div className="bg-stone-800/90 rounded-2xl rounded-tl-none p-3 text-stone-200 max-w-[85%] leading-relaxed">
                      Olá! Bem-vindo à barbearia. Vamos agendar seu horário hoje?
                    </div>
                  </div>

                  {/* Message 2: Cliente */}
                  <div className="flex justify-end">
                    <div className="bg-amber-500 text-stone-950 font-semibold rounded-2xl rounded-tr-none p-3 max-w-[85%] leading-relaxed">
                      Quero agendar um Corte Degradê.
                    </div>
                  </div>

                  {/* Message 3: Barbearia */}
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center text-[10px] font-bold shrink-0">
                      ✂️
                    </div>
                    <div className="bg-stone-800/90 rounded-2xl rounded-tl-none p-3 text-stone-200 max-w-[85%] space-y-2">
                      <p>Perfeito! Qual barbeiro você prefere?</p>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <span className="px-2 py-1 rounded bg-stone-900 border border-stone-700 text-[10px] text-center text-stone-300">
                          João Silva
                        </span>
                        <span className="px-2 py-1 rounded bg-stone-900 border border-stone-700 text-[10px] text-center text-stone-300">
                          Carlos Barbeiro
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Message 4: Confirmação */}
                  <div className="p-3 rounded-xl bg-stone-900 border border-amber-500/40 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-white text-[11px]">
                      <span>Horário Confirmado!</span>
                      <span className="text-amber-400 font-mono text-[10px]">MB-847291</span>
                    </div>
                    <div className="text-[10px] text-stone-400">
                      Quinta, 10:30 • João Silva • R$ 45,00
                    </div>
                  </div>

                  {/* CTA inside mockup */}
                  <Link
                    to="/vintage-barber"
                    className="block w-full py-2.5 text-center rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition shadow"
                  >
                    Testar Chat de Agendamento
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. A AGENDA DO BARBEIRO (VISUALIZAÇÃO MULTIPROFISSIONAL EM TEMPO REAL) */}
      {/* ========================================================================= */}
      <section id="para-barbeiros" className="py-20 border-b border-stone-900 bg-stone-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">
              Para o Barbeiro e a Equipe
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-2 mb-4 font-display">
              Sua bancada organizada. Seus atendimentos no controle.
            </h2>
            <p className="text-stone-400 text-sm sm:text-base">
              Visualize em tempo real quem está na cadeira, os próximos horários marcados e o
              faturamento diário de cada profissional da equipe.
            </p>
          </div>

          {/* Agenda Realistic Mockup Container */}
          <div className="rounded-3xl bg-stone-950 border border-stone-800 p-4 sm:p-6 shadow-2xl">
            {/* Top Agenda Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-base text-white">Agenda do Dia</span>
                <span className="text-xs text-stone-400 px-2 py-0.5 rounded-full bg-stone-900 border border-stone-800">
                  Hoje • Quinta-feira
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/agenda"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Acessar Agenda Completa</span>
                </Link>
              </div>
            </div>

            {/* Barbers Columns Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
              {/* Column 1: João Silva */}
              <div className="rounded-2xl bg-stone-900/80 border border-stone-800 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <div>
                      <div className="font-bold text-sm text-white">João Silva</div>
                      <div className="text-[11px] text-stone-400">Degradê & Barba</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-300">4 agendamentos</span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Item 1 */}
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-amber-400 font-bold">09:30 - 10:00</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                        Concluído
                      </span>
                    </div>
                    <div className="font-bold text-stone-200 mt-1">Rodrigo Almeida</div>
                    <div className="text-stone-400 text-[11px]">Corte Degradê • R$ 45,00</div>
                  </div>

                  {/* Item 2 */}
                  <div className="p-3 rounded-xl bg-stone-950 border border-blue-500/40">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-amber-400 font-bold">11:00 - 11:30</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold text-[10px]">
                        Confirmado
                      </span>
                    </div>
                    <div className="font-bold text-stone-200 mt-1">Felipe Rodrigues</div>
                    <div className="text-stone-400 text-[11px]">Barba Terapia • R$ 35,00</div>
                  </div>
                </div>
              </div>

              {/* Column 2: Carlos Barbeiro */}
              <div className="rounded-2xl bg-stone-900/80 border border-stone-800 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <div>
                      <div className="font-bold text-sm text-white">Carlos Barbeiro</div>
                      <div className="text-[11px] text-stone-400">Mestre da Barba</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-300">5 agendamentos</span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Item 1 */}
                  <div className="p-3 rounded-xl bg-stone-950 border border-amber-500/40">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-amber-400 font-bold">10:30 - 11:20</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold text-[10px]">
                        Na Cadeira
                      </span>
                    </div>
                    <div className="font-bold text-stone-200 mt-1">Guilherme Santos</div>
                    <div className="text-stone-400 text-[11px]">Combo Cabelo + Barba • R$ 70,00</div>
                  </div>

                  {/* Item 2 */}
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-stone-400 font-bold">14:30 - 15:00</span>
                      <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-semibold text-[10px]">
                        Agendado
                      </span>
                    </div>
                    <div className="font-bold text-stone-200 mt-1">Thiago Mendes</div>
                    <div className="text-stone-400 text-[11px]">Corte Tradicional • R$ 45,00</div>
                  </div>
                </div>
              </div>

              {/* Column 3: Lucas Ferreira */}
              <div className="rounded-2xl bg-stone-900/80 border border-stone-800 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <div>
                      <div className="font-bold text-sm text-white">Lucas Ferreira</div>
                      <div className="text-[11px] text-stone-400">Cortes Modernos</div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-300">3 agendamentos</span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Item 1 */}
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-stone-400 font-bold">14:00 - 14:30</span>
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold text-[10px]">
                        Confirmado
                      </span>
                    </div>
                    <div className="font-bold text-stone-200 mt-1">Eduardo Lima</div>
                    <div className="text-stone-400 text-[11px]">Corte Degradê • R$ 45,00</div>
                  </div>

                  {/* Item 2 */}
                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-stone-400 font-bold">16:00 - 16:30</span>
                      <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-semibold text-[10px]">
                        Agendado
                      </span>
                    </div>
                    <div className="font-bold text-stone-200 mt-1">Marcelo Castro</div>
                    <div className="text-stone-400 text-[11px]">Pezinho & Acabamento • R$ 20,00</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. GESTÃO COMPLETA DA BARBEARIA (APENAS RECURSOS REAIS DO PROJETO) */}
      {/* ========================================================================= */}
      <section id="recursos" className="py-20 border-b border-stone-900 bg-stone-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">
              Funcionalidades do Sistema
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white mt-2 mb-4 font-display">
              Tudo o que sua barbearia precisa em um só lugar.
            </h2>
            <p className="text-stone-400 text-sm sm:text-base">
              Desenvolvido com base no fluxo de trabalho de barbearias reais para simplificar cada
              etapa da rotina operacional.
            </p>
          </div>

          {/* 6 Real Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Agenda */}
            <div className="p-6 rounded-3xl bg-stone-900/60 border border-stone-800 hover:border-stone-700 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5 border border-amber-500/20">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Agenda Multiprofissional</h3>
              <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
                Visualização diária em colunas por barbeiro. Acompanhamento de status de cada cadeira
                e agendamento rápido no balcão.
              </p>
            </div>

            {/* 2. Clientes */}
            <div className="p-6 rounded-3xl bg-stone-900/60 border border-stone-800 hover:border-stone-700 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5 border border-amber-500/20">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Base de Clientes</h3>
              <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
                Histórico completo de visitas, total investido na barbearia e atalho de contato
                direto para o WhatsApp do cliente com 1 toque.
              </p>
            </div>

            {/* 3. Profissionais & Comissões */}
            <div className="p-6 rounded-3xl bg-stone-900/60 border border-stone-800 hover:border-stone-700 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5 border border-amber-500/20">
                <UserCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Profissionais & Comissões</h3>
              <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
                Cadastro de horários de expediente de cada barbeiro, cores personalizadas para a
                agenda e cálculo automático de comissão por serviço.
              </p>
            </div>

            {/* 4. Serviços & Preços */}
            <div className="p-6 rounded-3xl bg-stone-900/60 border border-stone-800 hover:border-stone-700 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5 border border-amber-500/20">
                <Scissors className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Catálogo de Serviços</h3>
              <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
                Organização de cortes, barbas, pigmentação e combos com definição exata de duração em
                minutos e valores cobrados.
              </p>
            </div>

            {/* 5. Financeiro Integrado */}
            <div className="p-6 rounded-3xl bg-stone-900/60 border border-stone-800 hover:border-stone-700 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5 border border-amber-500/20">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Controle Financeiro</h3>
              <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
                Livro-caixa com faturamento bruto e líquido, separação de receitas de corte e produtos
                de bancada, controle de despesas e repasses.
              </p>
            </div>

            {/* 6. Estoque & Produtos */}
            <div className="p-6 rounded-3xl bg-stone-900/60 border border-stone-800 hover:border-stone-700 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-5 border border-amber-500/20">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Controle de Estoque</h3>
              <p className="text-stone-400 text-xs sm:text-sm leading-relaxed">
                Controle de produtos de revenda (pomadas, óleos) e materiais de consumo interno com
                alertas visuais para reposição de estoque mínimo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. BENEFÍCIOS TANGÍVEIS (INSPIRADO NAS REFERÊNCIAS VISUAIS) */}
      {/* ========================================================================= */}
      <section className="py-20 border-b border-stone-900 bg-stone-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-stone-900/40 border border-stone-800">
              <div className="text-2xl font-black text-amber-500 mb-2 font-display">02 Horas</div>
              <div className="font-bold text-white text-sm mb-1">Economizadas por dia</div>
              <p className="text-stone-400 text-xs leading-relaxed">
                Sem precisar parar o corte para responder mensagens sobre horários livres no WhatsApp.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-stone-900/40 border border-stone-800">
              <div className="text-2xl font-black text-amber-500 mb-2 font-display">24/7</div>
              <div className="font-bold text-white text-sm mb-1">Agendamento ativo</div>
              <p className="text-stone-400 text-xs leading-relaxed">
                Seus clientes agendam a qualquer hora do dia ou da noite, mesmo quando a barbearia está
                fechada.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-stone-900/40 border border-stone-800">
              <div className="text-2xl font-black text-amber-500 mb-2 font-display">Zero Faltas</div>
              <div className="font-bold text-white text-sm mb-1">Mais compromisso</div>
              <p className="text-stone-400 text-xs leading-relaxed">
                Com código de reserva e lembrete claro do atendimento no celular do cliente.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-stone-900/40 border border-stone-800">
              <div className="text-2xl font-black text-amber-500 mb-2 font-display">100% Celular</div>
              <div className="font-bold text-white text-sm mb-1">Mobilidade total</div>
              <p className="text-stone-400 text-xs leading-relaxed">
                Acesse a agenda da sua cadeira diretamente no smartphone enquanto atende seus clientes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. DÚVIDAS FREQUENTES (ACORDEON INTERATIVO) */}
      {/* ========================================================================= */}
      <section id="duvidas" className="py-20 border-b border-stone-900 bg-stone-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">
              Tire Suas Dúvidas
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2 mb-3 font-display">
              Perguntas Frequentes
            </h2>
            <p className="text-stone-400 text-sm">
              Tudo o que você precisa saber sobre o MBarber para sua barbearia.
            </p>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-stone-800 bg-stone-900/60 overflow-hidden transition"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-stone-200 hover:text-white transition"
                  >
                    <span>{item.question}</span>
                    <span className="p-1 rounded-lg bg-stone-800 text-amber-400 shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-stone-400 leading-relaxed border-t border-stone-800/60 pt-3">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. CTA FINAL DECISIVO */}
      {/* ========================================================================= */}
      <section className="py-20 bg-gradient-to-b from-stone-950 to-stone-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-br from-stone-900 via-stone-900/90 to-stone-950 border border-stone-800 text-center relative overflow-hidden shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-6 border border-amber-500/30">
              <Scissors className="w-8 h-8 stroke-[2.2]" />
            </div>

            <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight font-display">
              A melhor experiência para sua barbearia e seus clientes.
            </h2>
            <p className="text-stone-400 text-sm sm:text-base max-w-xl mx-auto mb-8">
              Praticidade para quem senta na cadeira, controle absoluto para quem comanda a navalha.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/vintage-barber"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm sm:text-base transition shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <span>Agendar Meu Horário</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-bold text-sm sm:text-base transition border border-stone-700"
              >
                <span>Acessar Painel da Barbearia</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 9. RODAPÉ ELEGANTE & MINIMALISTA */}
      {/* ========================================================================= */}
      <footer className="border-t border-stone-900 bg-stone-950 py-10 text-stone-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center font-black text-xs">
              <Scissors className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm text-white font-display">MBarber</span>
            <span className="text-stone-600">|</span>
            <span className="text-stone-500">Agendamento & Gestão Inteligente</span>
          </div>

          <div className="flex items-center gap-6 text-stone-400 font-medium">
            <a href="#como-funciona" className="hover:text-stone-200 transition">
              Como Funciona
            </a>
            <a href="#para-barbeiros" className="hover:text-stone-200 transition">
              Para Barbeiros
            </a>
            <a href="#recursos" className="hover:text-stone-200 transition">
              Recursos
            </a>
            <Link to="/auth/login" className="hover:text-amber-400 transition">
              Área do Profissional
            </Link>
          </div>

          <div className="text-stone-500 text-[11px]">
            © {new Date().getFullYear()} MBarber. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
};
