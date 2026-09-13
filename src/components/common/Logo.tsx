import React from "react";

/**
 * Caminho canônico para a logomarca vetorial do MBarber.
 * Única fonte de verdade para a identidade visual da plataforma.
 */
export const MBARBER_LOGO_PATH = "/mbarber_logo.svg";
export const MBARBER_BRAND_NAME = "MBarber";
export const MBARBER_FULL_NAME = "MetricBarber";
export const MBARBER_LOGO_ALT = "Logo MBarber - Gestão Inteligente para Barbearias";

export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl" | number;

export interface LogoIconProps {
  size?: LogoSize;
  className?: string;
  alt?: string;
}

const SIZE_CLASSES: Record<string, string> = {
  xs: "w-5 h-5",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

/**
 * Ícone da Logo MBarber (Navalha estilizada em formato M sobre fundo laranja)
 */
export const LogoIcon: React.FC<LogoIconProps> = ({
  size = "md",
  className = "",
  alt = MBARBER_LOGO_ALT,
}) => {
  const sizeClass = typeof size === "string" ? SIZE_CLASSES[size] || SIZE_CLASSES.md : "";
  const inlineStyle = typeof size === "number" ? { width: size, height: size } : undefined;

  return (
    <img
      src={MBARBER_LOGO_PATH}
      alt={alt}
      style={inlineStyle}
      className={`rounded-xl object-contain shrink-0 shadow-md ${sizeClass} ${className}`}
      loading="eager"
    />
  );
};

export interface LogoProps {
  size?: LogoSize;
  className?: string;
  showText?: boolean;
  subtitle?: string;
  textClassName?: string;
  alt?: string;
}

/**
 * Componente de Logo MBarber (Ícone + Tipografia)
 */
export const Logo: React.FC<LogoProps> = ({
  size = "md",
  className = "",
  showText = true,
  subtitle,
  textClassName = "",
  alt = MBARBER_LOGO_ALT,
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={size} alt={alt} />
      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-extrabold text-xl tracking-tight text-white font-display leading-tight ${textClassName}`}
          >
            {MBARBER_BRAND_NAME}
          </span>
          {subtitle && (
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold -mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
