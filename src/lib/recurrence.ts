/**
 * Utilitários para Cálculo e Validação de Regras de Recorrência
 * Suporta:
 * 1. Dia específico do mês (ex: todo dia 15)
 * 2. Dia relativo do mês (ex: toda última sexta-feira do mês, 1ª segunda-feira do mês)
 * 3. Semanal (ex: toda terça-feira)
 * 4. Quinzenal (ex: a cada 2 semanas no sábado)
 */

export type RecurrenceType =
  | "weekly"
  | "biweekly"
  | "fixed_day_of_month"
  | "relative_day_of_month";

export interface RecurrenceRule {
  recurrenceType: RecurrenceType;
  dayOfWeek?: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  dayOfMonth?: number; // 1 a 31 (ex: todo dia 15)
  weekOfMonth?: number; // -1 = Última semana, 1 = 1ª, 2 = 2ª, 3 = 3ª, 4 = 4ª
  startDate?: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

export const DAYS_OF_WEEK_NAMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export const DAYS_OF_WEEK_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const WEEKS_OF_MONTH_OPTIONS = [
  { value: 1, label: "Primeira (1ª)" },
  { value: 2, label: "Segunda (2ª)" },
  { value: 3, label: "Terceira (3ª)" },
  { value: 4, label: "Quarta (4ª)" },
  { value: -1, label: "Última" },
];

/**
 * Converte string 'YYYY-MM-DD' em objeto Date sem desvios de fuso horário UTC.
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 12, 0, 0);
}

/**
 * Formata um objeto Date para string 'YYYY-MM-DD'.
 */
export function formatToDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Verifica se uma data específica atende aos critérios da regra de recorrência.
 */
export function isDateMatchingRecurrence(
  targetDate: string | Date,
  rule: RecurrenceRule
): boolean {
  const date = typeof targetDate === "string" ? parseLocalDate(targetDate) : targetDate;
  const dateStr = formatToDateInput(date);

  // 1. Validar limites de início e fim
  if (rule.startDate && dateStr < rule.startDate) {
    return false;
  }
  if (rule.endDate && dateStr > rule.endDate) {
    return false;
  }

  const dayOfWeek = date.getDay();
  const dayOfMonth = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth();

  switch (rule.recurrenceType) {
    case "weekly": {
      if (rule.dayOfWeek === undefined || rule.dayOfWeek === null) return false;
      return dayOfWeek === rule.dayOfWeek;
    }

    case "biweekly": {
      if (rule.dayOfWeek === undefined || rule.dayOfWeek === null) return false;
      if (dayOfWeek !== rule.dayOfWeek) return false;

      // Calcular intervalo de 2 semanas desde startDate (ou default)
      const baseDate = rule.startDate ? parseLocalDate(rule.startDate) : new Date(2026, 0, 1);
      const diffMs = date.getTime() - baseDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks % 2 === 0;
    }

    case "fixed_day_of_month": {
      if (!rule.dayOfMonth) return false;
      const targetDay = rule.dayOfMonth;

      // Se o mês tiver menos dias que o targetDay (ex: dia 31 em mês de 30 dias ou fevereiro),
      // verifica se hoje é o último dia do mês corrente
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      if (targetDay > lastDayOfMonth) {
        return dayOfMonth === lastDayOfMonth;
      }
      return dayOfMonth === targetDay;
    }

    case "relative_day_of_month": {
      if (rule.dayOfWeek === undefined || rule.dayOfWeek === null) return false;
      if (dayOfWeek !== rule.dayOfWeek) return false;

      const weekOrdinal = rule.weekOfMonth ?? -1;

      if (weekOrdinal === -1) {
        // Última ocorrência desse dia da semana no mês:
        // Se somarmos 7 dias, mudará de mês!
        const nextWeek = new Date(year, month, dayOfMonth + 7, 12, 0, 0);
        return nextWeek.getMonth() !== month;
      }

      // 1ª semana: dias 1 a 7
      // 2ª semana: dias 8 a 14
      // 3ª semana: dias 15 a 21
      // 4ª semana: dias 22 a 28
      const minDay = (weekOrdinal - 1) * 7 + 1;
      const maxDay = weekOrdinal * 7;
      return dayOfMonth >= minDay && dayOfMonth <= maxDay;
    }

    default:
      return false;
  }
}

/**
 * Gera uma descrição humana e elegante da regra de recorrência.
 * Ex: "Todo dia 15 do mês", "Toda última sexta-feira do mês", "Toda terça-feira às 14:00"
 */
export function formatRecurrenceDescription(rule: RecurrenceRule): string {
  let baseDesc = "";

  switch (rule.recurrenceType) {
    case "weekly": {
      const dayName = rule.dayOfWeek !== undefined ? DAYS_OF_WEEK_NAMES[rule.dayOfWeek] : "";
      baseDesc = `Toda ${dayName.toLowerCase()}`;
      break;
    }
    case "biweekly": {
      const dayName = rule.dayOfWeek !== undefined ? DAYS_OF_WEEK_NAMES[rule.dayOfWeek] : "";
      baseDesc = `A cada 15 dias na ${dayName.toLowerCase()}`;
      break;
    }
    case "fixed_day_of_month": {
      baseDesc = `Todo dia ${rule.dayOfMonth || 1} de cada mês`;
      break;
    }
    case "relative_day_of_month": {
      const dayName = rule.dayOfWeek !== undefined ? DAYS_OF_WEEK_NAMES[rule.dayOfWeek] : "";
      const weekLabel =
        WEEKS_OF_MONTH_OPTIONS.find((w) => w.value === rule.weekOfMonth)?.label.toLowerCase() ||
        "última";
      baseDesc = `Toda ${weekLabel} ${dayName.toLowerCase()} do mês`;
      break;
    }
    default:
      baseDesc = "Recorrência periódica";
  }

  if (rule.startTime && rule.endTime) {
    baseDesc += ` (${rule.startTime} às ${rule.endTime})`;
  } else if (rule.startTime) {
    baseDesc += ` às ${rule.startTime}`;
  }

  return baseDesc;
}

/**
 * Calcula as próximas datas que atendem à regra de recorrência a partir de uma data base.
 */
export function getNextOccurrences(
  rule: RecurrenceRule,
  count: number = 4,
  fromDateStr?: string
): Array<{ dateStr: string; formatted: string }> {
  const results: Array<{ dateStr: string; formatted: string }> = [];
  const baseDate = fromDateStr ? parseLocalDate(fromDateStr) : new Date();

  // Itera dia a dia procurando as próximas ocorrências (limite de 1 ano para segurança)
  const cursor = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 12, 0, 0);
  const maxSearchDays = 365;
  let daysChecked = 0;

  while (results.length < count && daysChecked < maxSearchDays) {
    const curDateStr = formatToDateInput(cursor);

    if (isDateMatchingRecurrence(curDateStr, rule)) {
      const dayShort = DAYS_OF_WEEK_SHORT[cursor.getDay()];
      const dayNum = String(cursor.getDate()).padStart(2, "0");
      const monthNum = String(cursor.getMonth() + 1).padStart(2, "0");
      const yearNum = cursor.getFullYear();

      results.push({
        dateStr: curDateStr,
        formatted: `${dayShort}, ${dayNum}/${monthNum}/${yearNum}`,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
    daysChecked++;
  }

  return results;
}
