function Button({ label, onClick, variant = "primary", disabled = false }) {
  const buttonClass = `btn btn-${variant}${disabled ? " btn-disabled" : ""}`;

  return (
    <button className={buttonClass} onClick={onClick} disabled={disabled}>
      {label && <span className="btn-label">{label}</span>}
    </button>
  );
}

export default Button;
