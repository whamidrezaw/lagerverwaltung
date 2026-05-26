import axios from 'axios';

const api = axios.create({ baseURL:'/api', timeout:15000 });

api.interceptors.request.use(cfg=>{
  const t=localStorage.getItem('token');
  if(t) cfg.headers.Authorization=`Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(r=>r, err=>{
  if(err.response?.status===401){
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href='/login';
  }
  return Promise.reject(err);
});

export const authAPI = {
  login: d  => api.post('/auth/login', d),
  getMe: () => api.get('/auth/me'),
};

export const usersAPI = {
  getAll:          ()        => api.get('/users'),
  create:          d         => api.post('/users', d),
  update:          (id,d)    => api.put(`/users/${id}`, d),
  updateBalance:   (id,bal)  => api.put(`/users/${id}/balance`, {balance:bal}),
  updateSortOrder: ids       => api.put('/users/sort-order', {orderedIds:ids}),
  changePassword:  (id,d)    => api.put(`/users/${id}/password`, d),
  deleteUser:      id        => api.delete(`/users/${id}`),
};

export const shiftsAPI = {
  getByWeek:    week        => api.get('/shifts', {params:{week}}),
  getByMonth:   (year,mon)  => api.get('/shifts/month', {params:{year,month:mon}}),
  create:       d           => api.post('/shifts', d),
  update:       (id,d)      => api.put(`/shifts/${id}`, d),
  delete:       id          => api.delete(`/shifts/${id}`),
  notifyAll:    week        => api.post('/shifts/notify', {week}),
  hoursSummary: week        => api.get('/shifts/hours-summary', {params:{week}}),
};

export default api;
