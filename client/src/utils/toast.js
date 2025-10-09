let subs = [];

export const showToast = (toast) => {
  const id = Math.random().toString(36).slice(2);
  const payload = { id, title: toast.title || 'Notification', message: toast.message || '', link: toast.link || null, timeout: toast.timeout ?? 5000 };
  subs.forEach((fn) => fn(payload));
  return id;
};

export const onToast = (fn) => {
  subs.push(fn);
  return () => { subs = subs.filter((f) => f !== fn); };
};
