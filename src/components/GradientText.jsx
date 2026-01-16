// src/components/GradientText.js

import "./GradientText.css";

export default function GradientText({
  children,
  className = "",
  // 設定一組預設的、漂亮的漸變色
  colors = ["#6366F1", "#A855F7", "#EC4899", "#6366F1"],
  animationSpeed = 5,
}) {
  // 將漸變樣式直接應用在元件上
  const gradientStyle = {
    backgroundImage: `linear-gradient(to right, ${colors.join(", ")})`,
    animationDuration: `${animationSpeed}s`,
  };

  // --- ✨ MODIFICATION START ✨ ---
  // 直接返回一個帶有漸變 class 和樣式的 span 元素
  // 這樣它就可以被放置在任何標籤（如 h1）內部
  return (
    <span className={`gradient-text-content ${className}`} style={gradientStyle}>
      {children}
    </span>
  );
  // --- ✨ MODIFICATION END ✨ ---
}
