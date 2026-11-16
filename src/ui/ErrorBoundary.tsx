import React from 'react';

// Last line of defence: a render error shows a calm recovery card instead of a blank screen. The save is never touched here.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: Error | null; copied: boolean }> {
    state = { err: null as Error | null, copied: false };
    static getDerivedStateFromError(err: Error) { return { err, copied: false }; }
    componentDidCatch(err: Error) { try { console.error('Path of Nine Heavens crashed:', err); } catch { /* ignore */ } }
    private rawSave(): string | null { return (window as any).__nhLastSave ?? null; } // kept by App at every device write
    render() {
        if (!this.state.err) return this.props.children;
        return (
            <div style={{ padding: 20, maxWidth: 420, margin: '40px auto', color: '#e8e0d0', fontFamily: 'Georgia, serif' }}>
                <h2 style={{ marginTop: 0 }}>The heavens flickered</h2>
                <p style={{ opacity: 0.8 }}>Something broke while drawing the screen. Your saved life was not touched. Reloading usually fixes it.</p>
                <button type="button" style={{ padding: '12px 18px', marginRight: 10, borderRadius: 8, border: 0, background: '#8a6a2f', color: '#fff' }} onClick={() => location.reload()}>Reload</button>
                <button type="button" style={{ padding: '12px 18px', borderRadius: 8, border: '1px solid #8a6a2f', background: 'transparent', color: '#e8e0d0' }}
                    onClick={() => { const r = this.rawSave(); try { void navigator.clipboard?.writeText(r ?? ''); } catch { /* ignore */ } this.setState({ copied: true }); }}>
                    {this.state.copied ? 'Save copied' : 'Copy my save'}
                </button>
                <p style={{ opacity: 0.5, fontSize: 12, marginTop: 18 }}>{String(this.state.err.message ?? this.state.err).slice(0, 160)}</p>
            </div>
        );
    }
}
