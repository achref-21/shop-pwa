interface SupplierAvatarProps {
  name: string;
  size?: number;
}

export function SupplierAvatar({ name, size = 36 }: SupplierAvatarProps) {
  const initials = name.slice(0, 2).toUpperCase();
  const fontSize = Math.max(12, Math.round(size * 0.38));

  return (
    <div
      aria-label={`Avatar ${name}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(46, 196, 182, 0.15)",
        color: "var(--color-accent)",
        fontFamily: "Outfit, sans-serif",
        fontWeight: 600,
        fontSize: `${fontSize}px`,
        lineHeight: 1,
        userSelect: "none",
      }}
    >
      {initials}
    </div>
  );
}

export default SupplierAvatar;
