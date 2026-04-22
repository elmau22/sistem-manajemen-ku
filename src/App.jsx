import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Briefcase, 
  LayoutDashboard, 
  Mail, 
  MessageCircle, 
  Plus, 
  CheckCircle,
  Clock,
  Lock,
  LogOut,
  Bell,
  FileText,
  Edit,
  X,
  AlertTriangle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc } from 'firebase/firestore';

// Konfigurasi Firebase Anda
const firebaseConfig = {
  apiKey: "AIzaSyC_CgxP9ylWxAvVVVsjQf31AJQjScDGHVE",
  authDomain: "sistem-manajemen-app.firebaseapp.com",
  projectId: "sistem-manajemen-app",
  storageBucket: "sistem-manajemen-app.firebasestorage.app",
  messagingSenderId: "120992134877",
  appId: "1:120992134877:web:78e6a109c4613e70d10d34"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'sys-manage-app';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // State untuk Form Login/Register
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authRegCode, setAuthRegCode] = useState(''); // State untuk Kode Registrasi
  const [authError, setAuthError] = useState('');

  // ==========================================
  // DATABASE & STATE MANAGEMENT
  // ==========================================
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  
  // State untuk Notifikasi
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // State untuk Modal Update Proyek
  const [editingProject, setEditingProject] = useState(null);
  const [projectReport, setProjectReport] = useState('');
  const [newProgress, setNewProgress] = useState(0);

  // 1. Pantau Status Login Pengguna
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sinkronisasi Data & Cek Notifikasi
  useEffect(() => {
    if (!user) return;

    const clientsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'clients');
    const unsubClients = onSnapshot(clientsRef, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const projectsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'projects');
    const unsubProjects = onSnapshot(projectsRef, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const schedulesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'schedules');
    const unsubSchedules = onSnapshot(schedulesRef, (snapshot) => {
      const scheduleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(scheduleData);

      // Logika Notifikasi Pengingat Jadwal
      const today = new Date().toISOString().split('T')[0];
      const alerts = scheduleData.filter(s => s.status === 'Pending' && s.date <= today);
      setNotifications(alerts);
    });

    return () => {
      unsubClients();
      unsubProjects();
      unsubSchedules();
    };
  }, [user]);

  // ==========================================
  // FUNGSI AUTENTIKASI (KODE KEAMANAN DITAMBAHKAN)
  // ==========================================
  const handleAuthentication = async (e) => {
    e.preventDefault();
    setAuthError('');

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        // Cek Kode Registrasi (Batasan Aplikasi)
        if (authRegCode !== 'SYS-ADMIN-2026') {
          setAuthError('Kode Registrasi Perusahaan tidak valid!');
          return;
        }
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        alert("Akun berhasil dibuat! Anda sekarang otomatis masuk.");
      }
    } catch (error) {
      // Penanganan Error yang Lebih Rapi
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('Email ini sudah terdaftar. Silakan klik "Kembali ke Login" untuk masuk.');
      } 
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAuthError('Email atau Password salah.');
      } 
      else if (error.code === 'auth/weak-password') {
        setAuthError('Password terlalu lemah (minimal 6 karakter).');
      } 
      else {
        console.error("Auth Error:", error);
        setAuthError('Terjadi kesalahan. Pastikan format email benar.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveTab('dashboard');
    } catch (error) { console.error("Logout error", error); }
  };

  // ==========================================
  // FUNGSI AKSI DATA
  // ==========================================
  const handleFollowUpWA = (phone, name) => {
    const message = encodeURIComponent(`Halo Bpk/Ibu ${name}, saya ingin menindaklanjuti progres pertemuan kita sebelumnya...`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const handleFollowUpEmail = (email, name) => {
    const subject = encodeURIComponent('Follow Up Project');
    const body = encodeURIComponent(`Halo Bpk/Ibu ${name},\n\nSemoga hari Anda menyenangkan...`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const addClient = async (e) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.target);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'clients'), {
        name: formData.get('name'),
        company: formData.get('company'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        status: 'Prospek Baru',
        createdAt: Date.now()
      });
      e.target.reset();
    } catch (error) { console.error(error); }
  };

  // Tambah Proyek dengan Timeline
  const addProject = async (e) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.target);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {
        name: formData.get('name'),
        client: formData.get('client'),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        progress: 0,
        status: 'Berjalan',
        lastReport: 'Proyek baru dimulai.',
        createdAt: Date.now()
      });
      e.target.reset();
    } catch (error) { console.error(error); }
  };

  // Update Progress Proyek Bersyarat (Wajib Laporan)
  const updateProjectProgress = async (e) => {
    e.preventDefault();
    if (!projectReport.trim()) {
      alert("Laporan progres wajib diisi sebagai bukti pengerjaan!");
      return;
    }
    
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'projects', editingProject.id);
      await updateDoc(docRef, {
        progress: Number(newProgress),
        status: Number(newProgress) >= 100 ? 'Selesai' : 'Berjalan',
        lastReport: projectReport,
        updatedAt: Date.now()
      });
      setEditingProject(null);
      setProjectReport('');
      setNewProgress(0);
      alert("Progres berhasil diperbarui!");
    } catch (error) {
      console.error(error);
    }
  };

  const addSchedule = async (e) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.target);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'schedules'), {
        task: formData.get('task'),
        date: formData.get('date'),
        team: formData.get('team'),
        status: 'Pending',
        createdAt: Date.now()
      });
      e.target.reset();
    } catch (error) { console.error(error); }
  };

  // ==========================================
  // KOMPONEN TAMPILAN (VIEWS)
  // ==========================================
  const DashboardView = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Utama</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-500 text-white p-6 rounded-xl shadow-md flex items-center justify-between">
          <div><p className="text-blue-100">Total Klien</p><h3 className="text-3xl font-bold">{clients.length}</h3></div>
          <Users size={40} className="opacity-50" />
        </div>
        <div className="bg-emerald-500 text-white p-6 rounded-xl shadow-md flex items-center justify-between">
          <div><p className="text-emerald-100">Proyek Aktif</p><h3 className="text-3xl font-bold">{projects.filter(p => p.progress < 100).length}</h3></div>
          <Briefcase size={40} className="opacity-50" />
        </div>
        <div className="bg-orange-500 text-white p-6 rounded-xl shadow-md flex items-center justify-between relative">
          <div><p className="text-orange-100">Jadwal Menunggu</p><h3 className="text-3xl font-bold">{schedules.filter(s => s.status !== 'Selesai').length}</h3></div>
          <Calendar size={40} className="opacity-50" />
          {notifications.length > 0 && (
            <span className="absolute top-4 right-4 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
            </span>
          )}
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
          <div className="flex items-center text-red-700 font-bold mb-2">
            <AlertTriangle size={20} className="mr-2" /> Peringatan Jadwal (Hari Ini / Terlewat)
          </div>
          <ul className="list-disc ml-6 text-red-600 text-sm">
            {notifications.map(n => (
              <li key={n.id}><strong>{n.date}</strong> - {n.task} (Tim: {n.team})</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const ProjectView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Manajemen Proyek & Timeline</h2>
      
      {/* Form Tambah Proyek Baru */}
      <form onSubmit={addProject} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div><label className="block text-sm text-gray-600 mb-1">Nama Proyek</label><input required name="name" className="w-full border rounded-lg p-2" /></div>
        <div><label className="block text-sm text-gray-600 mb-1">Klien</label><input required name="client" className="w-full border rounded-lg p-2" /></div>
        <div><label className="block text-sm text-gray-600 mb-1">Tgl Mulai</label><input required type="date" name="startDate" className="w-full border rounded-lg p-2" /></div>
        <div><label className="block text-sm text-gray-600 mb-1">Target Selesai</label><input required type="date" name="endDate" className="w-full border rounded-lg p-2" /></div>
        <div className="md:col-span-4 flex justify-end">
          <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg flex items-center hover:bg-emerald-700"><Plus size={18} className="mr-2" /> Buat Proyek Baru</button>
        </div>
      </form>

      {/* Tabel Proyek Lengkap */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr><th className="p-4">Proyek & Klien</th><th className="p-4">Timeline</th><th className="p-4">Progres</th><th className="p-4">Aksi</th></tr>
          </thead>
          <tbody>
            {projects.map(project => (
              <tr key={project.id} className="border-b hover:bg-gray-50">
                <td className="p-4">
                  <div className="font-bold text-gray-800">{project.name}</div>
                  <div className="text-sm text-gray-500">{project.client}</div>
                </td>
                <td className="p-4">
                  <div className="text-xs text-gray-500">Mulai: {project.startDate}</div>
                  <div className="text-xs text-red-500 font-semibold">Deadline: {project.endDate}</div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${project.progress >= 100 ? 'bg-green-500' : 'bg-blue-600'}`} style={{ width: `${project.progress}%` }}></div></div>
                    <span className="text-sm font-bold">{project.progress}%</span>
                  </div>
                  <div className="text-xs text-gray-500 line-clamp-1 italic bg-gray-100 p-1 rounded">"{project.lastReport}"</div>
                </td>
                <td className="p-4">
                  <button onClick={() => {setEditingProject(project); setNewProgress(project.progress);}} className="text-blue-600 bg-blue-50 p-2 rounded hover:bg-blue-100 flex items-center gap-1 text-sm">
                    <Edit size={16} /> Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Edit Proyek Bersyarat */}
      {editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Update Progres Proyek</h3>
              <button onClick={() => setEditingProject(null)} className="text-gray-500 hover:text-red-500"><X size={24} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Proyek: <strong className="text-gray-800">{editingProject.name}</strong></p>
            <form onSubmit={updateProjectProgress} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Progres Baru (%)</label>
                <input type="number" min="0" max="100" value={newProgress} onChange={(e) => setNewProgress(e.target.value)} className="w-full border p-2 rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Laporan Pengerjaan <span className="text-red-500">*wajib</span></label>
                <textarea rows="3" placeholder="Jelaskan apa yang sudah dikerjakan..." value={projectReport} onChange={(e) => setProjectReport(e.target.value)} className="w-full border p-2 rounded-lg" required></textarea>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Simpan Pembaruan</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const ScheduleView = () => {
    const toggleStatus = async (item) => {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'schedules', item.id), {
          status: item.status === 'Selesai' ? 'Pending' : 'Selesai'
        });
      } catch (error) { console.error(error); }
    };

    // Sortir jadwal agar yang terdekat ada di atas
    const sortedSchedules = [...schedules].sort((a, b) => new Date(a.date) - new Date(b.date));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Kalender & Tugas Tim</h2>
        
        <form onSubmit={addSchedule} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]"><label className="block text-sm text-gray-600 mb-1">Tugas</label><input required name="task" className="w-full border rounded-lg p-2" /></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm text-gray-600 mb-1">Tanggal</label><input required type="date" name="date" className="w-full border rounded-lg p-2" /></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm text-gray-600 mb-1">Tim</label><input required name="team" className="w-full border rounded-lg p-2" /></div>
          <button type="submit" className="bg-orange-500 text-white px-6 py-2 rounded-lg flex items-center hover:bg-orange-600"><Plus size={18} className="mr-2" /> Tambah Agenda</button>
        </form>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
          {sortedSchedules.map(schedule => {
            const isToday = schedule.date === new Date().toISOString().split('T')[0];
            const isOverdue = schedule.date < new Date().toISOString().split('T')[0] && schedule.status !== 'Selesai';

            return (
            <div key={schedule.id} className={`flex items-center justify-between p-4 border-b transition ${isToday ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center gap-4">
                <button onClick={() => toggleStatus(schedule)} className={schedule.status === 'Selesai' ? 'text-green-500' : 'text-gray-300'}><CheckCircle size={24} /></button>
                <div>
                  <h4 className={`font-semibold ${schedule.status === 'Selesai' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {schedule.task}
                    {isToday && schedule.status !== 'Selesai' && <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">HARI INI</span>}
                    {isOverdue && <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">TERLE ঐতিহ্যAT</span>}
                  </h4>
                  <div className="flex items-center text-sm gap-4 mt-1">
                    <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : 'text-gray-500'}`}><Clock size={14} /> {new Date(schedule.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span className="flex items-center gap-1 text-gray-500"><Users size={14} /> {schedule.team}</span>
                  </div>
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>
    );
  };

  // ==========================================
  // RENDER LAYOUT
  // ==========================================
  if (isLoadingAuth) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><p className="text-white animate-pulse">Memuat Keamanan Sistem...</p></div>;
  }

  // Tampilan Halaman Login / Register Berkeamanan
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex justify-center mb-6"><div className="bg-blue-100 p-3 rounded-full text-blue-600"><Lock size={32} /></div></div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">{isLoginMode ? 'Login Terenkripsi' : 'Pendaftaran Karyawan'}</h2>
          <p className="text-center text-gray-500 mb-8">{isLoginMode ? 'Masukkan akses Anda' : 'Butuh kode akses dari Admin Perusahaan'}</p>
          
          <form onSubmit={handleAuthentication} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Perusahaan</label>
              <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="nama@perusahaan.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Minimal 6 karakter" />
            </div>
            
            {/* Input khusus Mode Register */}
            {!isLoginMode && (
              <div className="pt-2 border-t mt-4">
                <label className="block text-sm font-bold text-red-600 mb-1">Kode Registrasi Perusahaan <AlertTriangle size={14} className="inline mb-1"/></label>
                <input type="text" value={authRegCode} onChange={(e) => setAuthRegCode(e.target.value)} required className="w-full border border-red-300 bg-red-50 rounded-lg p-3 focus:ring-2 focus:ring-red-500 focus:outline-none" placeholder="Masukkan kode rahasia..." />
              </div>
            )}

            {authError && <p className="text-red-500 text-sm font-medium bg-red-50 p-2 rounded">{authError}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg mt-4">
              {isLoginMode ? 'MASUK KE SISTEM' : 'DAFTARKAN AKUN'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm border-t pt-4">
            <span className="text-gray-600">{isLoginMode ? "Pegawai Baru? " : "Sudah punya akses? "}</span>
            <button onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); setAuthRegCode(''); }} className="text-blue-600 font-bold hover:underline">
              {isLoginMode ? 'Minta Akses Admin' : 'Kembali ke Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan Dashboard Jika Sudah Login
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      <nav className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-extrabold text-white tracking-wider flex items-center gap-2"><Briefcase size={28} className="text-blue-500" /> SYS-MANAGE</h1>
          <p className="text-xs mt-2 text-slate-400 truncate">{user.email}</p>
        </div>
        <div className="flex flex-row md:flex-col p-4 md:p-0 overflow-x-auto md:overflow-visible gap-2 md:gap-0 flex-1">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 w-full p-4 hover:bg-slate-800 transition ${activeTab === 'dashboard' ? 'bg-slate-800 text-blue-400 border-l-4 border-blue-500' : ''}`}><LayoutDashboard size={20} /> <span className="hidden md:inline">Dashboard</span></button>
          <button onClick={() => setActiveTab('clients')} className={`flex items-center gap-3 w-full p-4 hover:bg-slate-800 transition ${activeTab === 'clients' ? 'bg-slate-800 text-blue-400 border-l-4 border-blue-500' : ''}`}><Users size={20} /> <span className="hidden md:inline">Klien & Follow Up</span></button>
          <button onClick={() => setActiveTab('projects')} className={`flex items-center gap-3 w-full p-4 hover:bg-slate-800 transition ${activeTab === 'projects' ? 'bg-slate-800 text-blue-400 border-l-4 border-blue-500' : ''}`}><FileText size={20} /> <span className="hidden md:inline">Pantau Proyek</span></button>
          <button onClick={() => setActiveTab('schedules')} className={`flex items-center gap-3 w-full p-4 hover:bg-slate-800 transition ${activeTab === 'schedules' ? 'bg-slate-800 text-blue-400 border-l-4 border-blue-500' : ''}`}>
            <div className="relative">
              <Calendar size={20} />
              {notifications.length > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500"></span>}
            </div>
            <span className="hidden md:inline">Jadwal & Notifikasi</span>
          </button>
        </div>
        <div className="p-4 border-t border-slate-700">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full p-3 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition"><LogOut size={20} /> <span className="hidden md:inline">Keluar</span></button>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && <DashboardView />}
          {/* Untuk Klien view saya pindahkan ke fungsi bawaan karena tidak ada perubahan signifikan di prompt Anda untuk Klien */}
          {activeTab === 'clients' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">Manajemen Klien</h2>
              <form onSubmit={addClient} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]"><label className="block text-sm text-gray-600 mb-1">Nama</label><input required name="name" className="w-full border rounded-lg p-2" /></div>
                <div className="flex-1 min-w-[200px]"><label className="block text-sm text-gray-600 mb-1">Perusahaan</label><input required name="company" className="w-full border rounded-lg p-2" /></div>
                <div className="flex-1 min-w-[200px]"><label className="block text-sm text-gray-600 mb-1">WhatsApp</label><input required name="phone" className="w-full border rounded-lg p-2" placeholder="628..." /></div>
                <div className="flex-1 min-w-[200px]"><label className="block text-sm text-gray-600 mb-1">Email</label><input required type="email" name="email" className="w-full border rounded-lg p-2" /></div>
                <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center hover:bg-blue-700"><Plus size={18} className="mr-2" /> Tambah</button>
              </form>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b">
                    <tr><th className="p-4">Nama</th><th className="p-4">Perusahaan</th><th className="p-4">Status</th><th className="p-4">Follow Up</th></tr>
                  </thead>
                  <tbody>
                    {clients.map(client => (
                      <tr key={client.id} className="border-b hover:bg-gray-50">
                        <td className="p-4"><div className="font-medium text-gray-800">{client.name}</div><div className="text-sm text-gray-500">{client.phone}</div></td>
                        <td className="p-4 text-gray-600">{client.company}</td>
                        <td className="p-4"><span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{client.status}</span></td>
                        <td className="p-4 flex gap-2">
                          <button onClick={() => handleFollowUpWA(client.phone, client.name)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"><MessageCircle size={18} /></button>
                          <button onClick={() => handleFollowUpEmail(client.email, client.name)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"><Mail size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'projects' && <ProjectView />}
          {activeTab === 'schedules' && <ScheduleView />}
        </div>
      </main>
    </div>
  );
}