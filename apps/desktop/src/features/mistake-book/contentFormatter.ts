export function cleanDisplayContent(content: string): string {
  if (!content) return "";
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/```/g, "")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\\div/g, "÷")
    .replace(/\\times/g, "×")
    .replace(/\\pm/g, "±")
    .replace(/\\mp/g, "∓")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\infty/g, "∞")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/\$+/g, "")
    .trim();
}

export function formatMistakeContent(content: string): string {
  if (!content) return "";
  let cleaned = cleanDisplayContent(content);

  // Markdown: headers
  cleaned = cleaned
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>");

  // Markdown: bold and italic
  cleaned = cleaned
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Markdown: code blocks
  cleaned = cleaned.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Markdown: unordered lists
  cleaned = cleaned.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  cleaned = cleaned.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  // Markdown: ordered lists
  cleaned = cleaned.replace(/^\d+[.)] (.+)$/gm, "<li>$1</li>");

  // Markdown: blockquote
  cleaned = cleaned.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Markdown: horizontal rule
  cleaned = cleaned.replace(/^---$/gm, "<hr>");

  // LaTeX: display math
  cleaned = cleaned.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    return `<div class="math-display">${renderLatex(math)}</div>`;
  });

  // LaTeX: inline math
  cleaned = cleaned.replace(/\$([^$]+)\$/g, (_, math) => {
    return `<span class="math-inline">${renderLatex(math)}</span>`;
  });

  // Line breaks
  cleaned = cleaned.replace(/\n/g, "<br>");

  return cleaned;
}

function renderLatex(latex: string): string {
  let result = latex.trim();

  // Fractions: \frac{a}{b} → a/b
  result = result.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)");

  // Square root: \sqrt{x} → √(x)
  result = result.replace(/\\sqrt\{([^}]*)\}/g, "√($1)");

  // Common symbols
  const symbols: Record<string, string> = {
    "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
    "\\epsilon": "ε", "\\theta": "θ", "\\lambda": "λ", "\\mu": "μ",
    "\\pi": "π", "\\sigma": "σ", "\\phi": "φ", "\\omega": "ω",
    "\\Delta": "Δ", "\\Sigma": "Σ", "\\Omega": "Ω",
    "\\div": "÷", "\\times": "×", "\\pm": "±", "\\mp": "∓",
    "\\leq": "≤", "\\geq": "≥", "\\neq": "≠", "\\approx": "≈",
    "\\infty": "∞", "\\partial": "∂", "\\nabla": "∇",
    "\\rightarrow": "→", "\\leftarrow": "←", "\\Rightarrow": "⇒",
    "\\Leftarrow": "⇐", "\\leftrightarrow": "↔",
    "\\cdot": "·", "\\circ": "°", "\\degree": "°",
    "\\sin": "sin", "\\cos": "cos", "\\tan": "tan",
    "\\log": "log", "\\ln": "ln", "\\lg": "lg",
    "\\max": "max", "\\min": "min",
    "\\sum": "∑", "\\prod": "∏", "\\int": "∫",
    "\\cup": "∪", "\\cap": "∩", "\\in": "∈", "\\notin": "∉",
    "\\subset": "⊂", "\\supset": "⊃",
    "\\forall": "∀", "\\exists": "∃",
    "\\therefore": "∴", "\\because": "∵",
    "\\ldots": "…", "\\cdots": "⋯"
  };

  for (const [cmd, sym] of Object.entries(symbols)) {
    result = result.replaceAll(cmd, sym);
  }

  // Subscript and superscript
  result = result.replace(/\^\{([^}]*)\}/g, "<sup>$1</sup>");
  result = result.replace(/\^(\w)/g, "<sup>$1</sup>");
  result = result.replace(/_\{([^}]*)\}/g, "<sub>$1</sub>");
  result = result.replace(/_(\w)/g, "<sub>$1</sub>");

  // Remaining commands → strip
  result = result.replace(/\\[a-zA-Z]+/g, "");

  return result;
}
