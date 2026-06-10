interface Props {
  label: string
  value: number
  color: string
}

export function DimensionBar({ label, value, color }: Props) {
  const percentage = Math.min(100, Math.max(0, value))

  return (
    <div style={styles.container}>
      <div style={styles.labelRow}>
        <span style={styles.label}>{label}</span>
        <span style={styles.value}>{Math.round(percentage)}/100</span>
      </div>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: 16,
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 6,
    fontSize: 13,
  },
  label: {
    color: '#666',
    fontWeight: 500,
  },
  value: {
    color: '#999',
    fontWeight: 600,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.6s ease',
  },
}
