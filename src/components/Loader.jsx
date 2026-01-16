import React from "react";

const loaderStyle = {
  width: "18px",
  height: "18px",
  border: "2px solid var(--white-color)",
  borderBottomColor: "transparent",
  borderRadius: "50%",
  display: "inline-block",
  animation: "rotation 1s linear infinite",
};

const keyframes = `
@keyframes rotation {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}`;

const Loader = () => (
  <>
    <style>{keyframes}</style>
    <div style={loaderStyle}></div>
  </>
);

export default Loader;
