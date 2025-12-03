export default function UpdateModal({ open, version, onConfirm, onCancel }: { open: boolean; version: string | null; onConfirm: () => void; onCancel: () => void; }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, minWidth: 320, maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Actualización disponible</h3>
        <p>Hay una nueva versión disponible{version ? `: ${version}` : '.'} ¿Deseas actualizar ahora?</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onCancel} style={{ padding: '8px 14px', borderRadius: 8, background: '#9e9e9e', color: '#fff', border: 'none', cursor: 'pointer' }}>No</button>
          <button onClick={onConfirm} style={{ padding: '8px 14px', borderRadius: 8, background: '#1976d2', color: '#fff', border: 'none', cursor: 'pointer' }}>Actualizar</button>
        </div>
      </div>
    </div>
  );
}
