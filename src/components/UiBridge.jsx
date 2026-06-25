// UiBridge.jsx - UI 事件监听组件
// 订阅 uiEvents 事件，渲染 MUI 的 Snackbar/Dialog/Backdrop

import { useEffect, useState } from 'react';
import { Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Backdrop, CircularProgress, Typography } from '@mui/material';
import { uiEvents } from '../utils/ui';

export default function UiBridge() {
  const [toast, setToast] = useState(null);
  const [undoToast, setUndoToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(null);

  useEffect(() => {
    const offToast = uiEvents.on('toast', ({ msg, duration }) => {
      setToast({ msg, duration, key: Date.now() });
    });
    const offUndo = uiEvents.on('undo', ({ message, onUndo, duration }) => {
      setUndoToast({ message, onUndo, duration, key: Date.now() });
    });
    const offConfirm = uiEvents.on('confirm', ({ message, onConfirm }) => {
      setConfirm({ message, onConfirm, key: Date.now() });
    });
    const offLoading = uiEvents.on('loading', ({ show, message }) => {
      if (show) setLoading({ message });
      else setLoading(null);
    });
    return () => { offToast(); offUndo(); offConfirm(); offLoading(); };
  }, []);

  return (
    <>
      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.duration || 3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        key={toast?.key}
      >
        <Alert severity="info" variant="filled" onClose={() => setToast(null)}>{toast?.msg}</Alert>
      </Snackbar>

      <Snackbar
        open={!!undoToast}
        autoHideDuration={undoToast?.duration || 5000}
        onClose={() => setUndoToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        key={undoToast?.key}
      >
        <Alert severity="warning" variant="filled"
          action={
            <Button color="inherit" size="small" onClick={() => {
              undoToast?.onUndo?.();
              setUndoToast(null);
            }}>撤销</Button>
          }
        >
          {undoToast?.message}
        </Alert>
      </Snackbar>

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} key={confirm?.key}>
        <DialogTitle>确认操作</DialogTitle>
        <DialogContent><DialogContentText>{confirm?.message}</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>取消</Button>
          <Button color="primary" variant="contained" onClick={() => {
            const cb = confirm?.onConfirm;
            setConfirm(null);
            cb?.();
          }}>确定</Button>
        </DialogActions>
      </Dialog>

      <Backdrop open={!!loading} sx={{ zIndex: (t) => t.zIndex.drawer + 1, color: '#fff' }}>
        <CircularProgress color="inherit" />
        <Typography sx={{ ml: 2 }}>{loading?.message}</Typography>
      </Backdrop>
    </>
  );
}
