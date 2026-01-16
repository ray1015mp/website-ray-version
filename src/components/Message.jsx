import React from "react";

const messageStyle = {
  padding: "0.75rem 1rem",
  marginBottom: "1.5rem",
  borderRadius: "0.375rem",
  fontWeight: "500",
  textAlign: "center",
};

const typeStyles = {
  success: { backgroundColor: "#dcfce7", color: "#166534" },
  error: { backgroundColor: "#fee2e2", color: "#991b1b" },
  info: { backgroundColor: "#e0f2fe", color: "#075985" },
};

const Message = ({ text, type }) => {
  if (!text) return null;

  return <div style={{ ...messageStyle, ...typeStyles[type] }}>{text}</div>;
};

export default Message;
