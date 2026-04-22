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
  AlertTriangle,
  Trash2,
  ShieldCheck,
  Award
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

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
  
  // State Form Login/Register
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authRegCode, setAuthRegCode] = useState('');
  const [authError, setAuthError] = useState('');

  // ==========================================
  // DATABASE & STATE MANAGEMENT
  // ==========================================
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  
  const [notifications, setNotifications] = useState([]);

  // State Modal & Form
  const [editingProject, setEditingProject] = useState(null);
  const [projectReport, setProjectReport] = useState('');
  const [newProgress, setNewProgress] = useState(0);

  const [guaranteeModal, setGuaranteeModal] = useState(null);
  const [guaranteeDate, setGuaranteeDate] = useState('');

  // 1. Pantau Status Login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sinkronisasi Data Firestore
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
  // FUNGSI AUTENTIKASI
  // ==========================================
  const handleAuthentication = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        if (authRegCode !== 'SYS-ADMIN-2026') {
          setAuthError('Kode Registrasi Perusahaan tidak valid!');
          return;
        }
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') setAuthError('Email ini sudah terdaftar.');
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') setAuthError('Email atau Password salah.');
      else if (error.code === 'auth/weak-password') setAuthError('Password terlalu lemah (minimal 6 karakter).');
      else setAuthError('Terjadi kesalahan. Pastikan format email benar.');
    }
  };

  const handleLogout = async () => {
    try { await signOut(auth); setActiveTab('dashboard'); } catch (error) { console.error(error); }
  };

  // ==========================================
  // FUNGSI AKSI KLIEN & PROYEK
  // ==========================================
  const handleFollowUpWA = (phone, name, isPromo = false) => {
    let message = `Halo Bpk/Ibu ${name}, saya ingin menindaklanjuti progres pertemuan kita sebelumnya...`;
    if(isPromo) {
      message = `Halo Bpk/Ibu ${name}, semoga proyek sebelumnya memuaskan! Saat ini kami memiliki layanan baru yang mungkin bisa membantu bisnis Anda semakin berkembang...`;
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
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
        status: formData.get('status'), // Mengambil status prospek
        createdAt: Date.now()
      });
      e.target.reset();
    } catch (error) { console.error(error); }
  };

  const deleteClient = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'clients', id));
    } catch (error) { console.error(error); }
  };

  // Komponen Tombol Hapus dengan Konfirmasi Aman (Tanpa Alert)
  const SafeDeleteButton = ({ onConfirm }) => {
    const [isConfirming, setIsConfirming] = useState(false);
    return isConfirming ? (
      <div className="flex items-center gap-2">
        <button onClick={() => setIsConfirming(false)} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Batal</button>
        <button onClick={onConfirm} className="text-xs bg-red-600 text-white px-2 py-1 rounded">Yakin Hapus?</button>
      </div>
    ) : (
      <button onClick={() => setIsConfirming(true)} className="p-2 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 hover:text-red-600 transition"><Trash2 size={18} /></button>
    );
  };

  const addProject = async (e) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.target);
    
    const projectName = formData.get('name');
    const clientName = formData.get('client');
    const startDateStr = formData.get('startDate');
    const endDateStr = formData.get('endDate');
    const isAutoSchedule = formData.get('autoSchedule') === 'on';

    try {
      // 1. Simpan Data Proyek Utama
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'projects'), {
        name: projectName,
        client: clientName,
        startDate: startDateStr,
        endDate: endDateStr,
        progress: 0,
        status: 'On Going', // Default status
        lastReport: 'Proyek baru dimulai.',
        guaranteeDate: '', // Garansi kosong di awal
        createdAt: Date.now()
      });

      // 2. Buat Jadwal Otomatis (Jika dicentang)
      if (isAutoSchedule) {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);

        if (start && end && end > start) {
          const totalDays = (end - start) / (1000 * 60 * 60 * 24);
          
          // Hitung Titik Waktu
          const midPoint = new Date(start.getTime() + (totalDays / 2) * 24 * 60 * 60 * 1000); // 50% Waktu
          const testPoint = new Date(start.getTime() + (totalDays * 0.8) * 24 * 60 * 60 * 1000); // 80% Waktu

          const scheduleRef = collection(db, 'artifacts', appId, 'users', user.uid, 'schedules');

          // Tugas 1: UI/UX & Program (Tengah Waktu)
          await addDoc(scheduleRef, {
            task: `[${projectName}] Desain UI/UX & Pemrograman`,
            date: midPoint.toISOString().split('T')[0],
            team: 'Tim Dev & UI/UX',
            status: 'Pending',
            createdAt: Date.now()
          });

          // Tugas 2: Testing (Mendekati Akhir)
          await addDoc(scheduleRef, {
            task: `[${projectName}] Testing & QA`,
            date: testPoint.toISOString().split('T')[0],
            team: 'Tim QA (Tester)',
            status: 'Pending',
            createdAt: Date.now() + 1
          });

          // Tugas 3: Publish (Tepat di Deadline)
          await addDoc(scheduleRef, {
            task: `[${projectName}] Publish & Serah Terima`,
            date: end.toISOString().split('T')[0],
            team: 'Manajer Proyek',
            status: 'Pending',
            createdAt: Date.now() + 2
          });
        }
      }

      e.target.reset();
      if(isAutoSchedule) alert("Proyek & Jadwal Tim berhasil dibuat secara otomatis!");
    } catch (error) { console.error(error); }
  };

  const updateProjectProgress = async (e) => {
    e.preventDefault();
    if (!projectReport.trim()) return;
    
    const numProg = Number(newProgress);
    let newStatus = 'On Going';
    if (numProg > 0 && numProg < 100) newStatus = 'Progres';
    if (numProg >= 100) newStatus = 'Finish';

    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'projects', editingProject.id);
      await updateDoc(docRef, {
        progress: numProg,
        status: newStatus,
        lastReport: projectReport,
        updatedAt: Date.now()
      });
      setEditingProject(null);
      setProjectReport('');
      setNewProgress(0);
    } catch (error) { console.error(error); }
  };

  const updateGuarantee = async (e) => {
    e.preventDefault();
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'projects', guaranteeModal.id);
      await updateDoc(docRef, { guaranteeDate: guaranteeDate });
      setGuaranteeModal(null);
      setGuaranteeDate('');
    } catch(error) { console.error(error); }
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-500 text-white p-6 rounded-xl shadow-md flex items-center justify-between">
          <div><p className="text-blue-100">Total Klien</p><h3 className="text-3xl font-bold">{clients.length}</h3></div>
          <Users size={40} className="opacity-50" />
        </div>
        <div className="bg-orange-500 text-white p-6 rounded-xl shadow-md flex items-center justify-between">
          <div><p className="text-orange-100">Proyek On Going</p><h3 className="text-3xl font-bold">{projects.filter(p => p.status === 'On Going').length}</h3></div>
          <Clock size={40} className="opacity-50" />
        </div>
        <div className="bg-emerald-500 text-white p-6 rounded-xl shadow-md flex items-center justify-between">
          <div><p className="text-emerald-100">Proyek Progres</p><h3 className="text-3xl font-bold">{projects.filter(p => p.status === 'Progres').length}</h3></div>
          <Briefcase size={40} className="opacity-50" />
        </div>
        <div className="bg-purple-600 text-white p-6 rounded-xl shadow-md flex items-center justify-between">
          <div><p className="text-purple-200">Proyek Finish</p><h3 className="text-3xl font-bold">{projects.filter(p => p.status === 'Finish').length}</h3></div>
          <Award size={40} className="opacity-50" />
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

  const ClientView = () => {
    const hotProspekCount = clients.filter(c => c.status === 'Hot Prospek').length;
    const prospekCount = clients.filter(c => c.status === 'Prospek').length;
    const klienAktifCount = clients.filter(c => c.status === 'Klien Aktif').length;

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Manajemen Klien & Prospek</h2>
        
        {/* Panel Rangkuman Prospek */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border-l-4 border-red-500 p-4 rounded shadow-sm flex justify-between items-center">
            <div><p className="text-sm text-gray-500">Hot Prospek</p><p className="text-2xl font-bold text-gray-800">{hotProspekCount}</p></div>
            <div className="bg-red-100 p-2 rounded-full text-red-500"><Users size={20}/></div>
          </div>
          <div className="bg-white border-l-4 border-yellow-500 p-4 rounded shadow-sm flex justify-between items-center">
            <div><p className="text-sm text-gray-500">Prospek</p><p className="text-2xl font-bold text-gray-800">{prospekCount}</p></div>
            <div className="bg-yellow-100 p-2 rounded-full text-yellow-500"><Users size={20}/></div>
          </div>
          <div className="bg-white border-l-4 border-green-500 p-4 rounded shadow-sm flex justify-between items-center">
            <div><p className="text-sm text-gray-500">Klien Aktif</p><p className="text-2xl font-bold text-gray-800">{klienAktifCount}</p></div>
            <div className="bg-green-100 p-2 rounded-full text-green-500"><CheckCircle size={20}/></div>
          </div>
        </div>

        <form onSubmit={addClient} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]"><label className="block text-sm text-gray-600 mb-1">Nama</label><input required name="name" className="w-full border rounded-lg p-2" /></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm text-gray-600 mb-1">Perusahaan</label><input required name="company" className="w-full border rounded-lg p-2" /></div>
          <div className="flex-1 min-w-[150px]"><label className="block text-sm text-gray-600 mb-1">WhatsApp</label><input required name="phone" className="w-full border rounded-lg p-2" placeholder="628..." /></div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm text-gray-600 mb-1">Status Prospek</label>
            <select required name="status" className="w-full border rounded-lg p-2 bg-white">
              <option value="Prospek">Prospek Biasa</option>
              <option value="Hot Prospek">🔥 Hot Prospek</option>
              <option value="Klien Aktif">✅ Klien Aktif</option>
            </select>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center hover:bg-blue-700"><Plus size={18} className="mr-2" /> Tambah</button>
        </form>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr><th className="p-4">Nama & Kontak</th><th className="p-4">Perusahaan</th><th className="p-4">Status</th><th className="p-4">Aksi</th></tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} className="border-b hover:bg-gray-50">
                  <td className="p-4"><div className="font-medium text-gray-800">{client.name}</div><div className="text-sm text-gray-500">{client.phone}</div></td>
                  <td className="p-4 text-gray-600">{client.company}</td>
                  <td className="p-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      client.status === 'Hot Prospek' ? 'bg-red-100 text-red-700' :
                      client.status === 'Klien Aktif' ? 'bg-green-100 text-green-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="p-4 flex gap-2 items-center">
                    <button onClick={() => handleFollowUpWA(client.phone, client.name)} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Follow Up WA"><MessageCircle size={18} /></button>
                    <SafeDeleteButton onConfirm={() => deleteClient(client.id)} />
                  </td>
                </tr>
              ))}
              {clients.length === 0 && <tr><td colSpan="4" className="text-center p-8 text-gray-400">Belum ada data klien.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const ProjectView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Manajemen Proyek & Timeline</h2>
      
      <form onSubmit={addProject} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div><label className="block text-sm text-gray-600 mb-1">Nama Proyek</label><input required name="name" className="w-full border rounded-lg p-2" /></div>
        <div><label className="block text-sm text-gray-600 mb-1">Klien</label><input required name="client" className="w-full border rounded-lg p-2" /></div>
        <div><label className="block text-sm text-gray-600 mb-1">Tgl Mulai</label><input required type="date" name="startDate" className="w-full border rounded-lg p-2" /></div>
        <div><label className="block text-sm text-gray-600 mb-1">Target Selesai</label><input required type="date" name="endDate" className="w-full border rounded-lg p-2" /></div>
        
        <div className="md:col-span-4 flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="autoSchedule" defaultChecked className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-blue-900">Buat Jadwal Tim Otomatis (UI/UX, Testing, Publish)</span>
          </label>
          <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg flex items-center hover:bg-emerald-700"><Plus size={18} className="mr-2" /> Buat Proyek Baru</button>
        </div>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr><th className="p-4">Proyek & Klien</th><th className="p-4">Timeline</th><th className="p-4">Status & Progres</th><th className="p-4">Aksi</th></tr>
          </thead>
          <tbody>
            {projects.filter(p => p.status !== 'Finish').map(project => (
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
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${project.status === 'On Going' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{project.status}</span>
                    <span className="text-sm font-bold">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1"><div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${project.progress}%` }}></div></div>
                  <div className="text-xs text-gray-500 line-clamp-1 italic">"{project.lastReport}"</div>
                </td>
                <td className="p-4">
                  <button onClick={() => {setEditingProject(project); setNewProgress(project.progress);}} className="text-blue-600 bg-blue-50 p-2 rounded hover:bg-blue-100 flex items-center gap-1 text-sm">
                    <Edit size={16} /> Update
                  </button>
                </td>
              </tr>
            ))}
            {projects.filter(p => p.status !== 'Finish').length === 0 && <tr><td colSpan="4" className="text-center p-8 text-gray-400">Tidak ada proyek aktif. Semua proyek telah selesai.</td></tr>}
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
            <form onSubmit={updateProjectProgress} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Progres Baru (%)</label>
                <input type="number" min="0" max="100" value={newProgress} onChange={(e) => setNewProgress(e.target.value)} className="w-full border p-2 rounded-lg" required />
                <p className="text-xs text-gray-500 mt-1">Jika diatur ke 100%, proyek otomatis berpindah ke tab 'Purna Jual'</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Laporan Pengerjaan <span className="text-red-500">*wajib</span></label>
                <textarea rows="3" value={projectReport} onChange={(e) => setProjectReport(e.target.value)} className="w-full border p-2 rounded-lg" required></textarea>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">Simpan Pembaruan</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const FinishedProjectView = () => {
    const finishedProjects = projects.filter(p => p.status === 'Finish');
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck size={32} className="text-purple-600" />
          <h2 className="text-2xl font-bold text-gray-800">Purna Jual & Pemantauan Garansi</h2>
        </div>
        <p className="text-gray-600 text-sm mb-4">Proyek yang telah selesai 100% akan masuk ke sini. Anda dapat melacak masa garansi dan menawarkan jasa tambahan kepada klien-klien ini.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {finishedProjects.map(project => {
            const clientData = clients.find(c => c.name === project.client);
            const clientPhone = clientData ? clientData.phone : '';
            const isWarrantyActive = project.guaranteeDate && new Date(project.guaranteeDate) >= new Date();

            return (
              <div key={project.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{project.name}</h3>
                    <p className="text-sm text-gray-500">Klien: {project.client}</p>
                  </div>
                  <span className="bg-green-100 text-green-700 px-2 py-1 text-xs font-bold rounded flex items-center gap-1"><Award size={14}/> FINISH</span>
                </div>
                
                <div className="bg-slate-50 p-3 rounded-lg mb-4 text-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-600">Batas Garansi:</span>
                    {project.guaranteeDate ? (
                      <span className={`font-semibold ${isWarrantyActive ? 'text-green-600' : 'text-red-500'}`}>
                        {new Date(project.guaranteeDate).toLocaleDateString('id-ID')}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Belum diatur</span>
                    )}
                  </div>
                  <button onClick={() => setGuaranteeModal(project)} className="text-blue-600 text-xs hover:underline mt-1">Set/Ubah Garansi</button>
                </div>

                {clientPhone ? (
                  <button onClick={() => handleFollowUpWA(clientPhone, project.client, true)} className="w-full flex items-center justify-center gap-2 bg-purple-50 text-purple-700 py-2 rounded-lg hover:bg-purple-100 font-medium text-sm transition">
                    <MessageCircle size={16} /> Tawarkan Jasa Baru (WA)
                  </button>
                ) : (
                  <p className="text-xs text-red-400 text-center">Nomor kontak klien tidak ditemukan</p>
                )}
              </div>
            )
          })}
          {finishedProjects.length === 0 && <p className="text-gray-500 col-span-2">Belum ada proyek yang berstatus Finish.</p>}
        </div>

        {/* Modal Atur Garansi */}
        {guaranteeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">Atur Garansi Proyek</h3>
                <button onClick={() => setGuaranteeModal(null)} className="text-gray-500 hover:text-red-500"><X size={24} /></button>
              </div>
              <p className="text-sm text-gray-600 mb-4">{guaranteeModal.name}</p>
              <form onSubmit={updateGuarantee} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Berlaku Sampai Tanggal</label>
                  <input type="date" value={guaranteeDate} onChange={(e) => setGuaranteeDate(e.target.value)} className="w-full border p-2 rounded-lg" required />
                </div>
                <button type="submit" className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700">Simpan Garansi</button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ScheduleView = () => {
    const toggleStatus = async (item) => {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'schedules', item.id), {
          status: item.status === 'Selesai' ? 'Pending' : 'Selesai'
        });
      } catch (error) { console.error(error); }
    };

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
                    {isOverdue && <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">TERLEWAT</span>}
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
  // RENDER LAYOUT UTAMA
  // ==========================================
  if (isLoadingAuth) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><p className="text-white animate-pulse">Memuat Keamanan Sistem...</p></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex justify-center mb-6"><div className="bg-blue-100 p-3 rounded-full text-blue-600"><Lock size={32} /></div></div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">{isLoginMode ? 'Login Terenkripsi' : 'Pendaftaran Karyawan'}</h2>
          
          <form onSubmit={handleAuthentication} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Perusahaan</label>
              <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            {!isLoginMode && (
              <div className="pt-2 border-t mt-4">
                <label className="block text-sm font-bold text-red-600 mb-1">Kode Registrasi <AlertTriangle size={14} className="inline mb-1"/></label>
                <input type="text" value={authRegCode} onChange={(e) => setAuthRegCode(e.target.value)} required className="w-full border border-red-300 bg-red-50 rounded-lg p-3 focus:ring-2 focus:ring-red-500 focus:outline-none" placeholder="SYS-ADMIN-2026" />
              </div>
            )}
            {authError && <p className="text-red-500 text-sm font-medium bg-red-50 p-2 rounded">{authError}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg mt-4">
              {isLoginMode ? 'MASUK KE SISTEM' : 'DAFTARKAN AKUN'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm border-t pt-4">
            <button onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} className="text-blue-600 font-bold hover:underline">
              {isLoginMode ? 'Minta Akses Pegawai Baru' : 'Kembali ke Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row font-sans">
      <nav className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-extrabold text-white tracking-wider flex items-center gap-2"><Briefcase size={28} className="text-blue-500" /> SYS-MANAGE</h1>
          <p className="text-xs mt-2 text-slate-400 truncate">{user.email}</p>
        </div>
        <div className="flex flex-row md:flex-col p-4 md:p-0 overflow-x-auto md:overflow-visible gap-2 md:gap-0 flex-1">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 w-full p-4 hover:bg-slate-800 transition ${activeTab === 'dashboard' ? 'bg-slate-800 text-blue-400 border-l-4 border-blue-500' : ''}`}><LayoutDashboard size={20} /> <span className="hidden md:inline">Dashboard</span></button>
          <button onClick={() => setActiveTab('clients')} className={`flex items-center gap-3 w-full p-4 hover:bg-slate-800 transition ${activeTab === 'clients' ? 'bg-slate-800 text-blue-400 border-l-4 border-blue-500' : ''}`}><Users size={20} /> <span className="hidden md:inline">Klien & Prospek</span></button>
          <button onClick={() => setActiveTab('projects')} className={`flex items-center gap-3 w-full p-4 hover:bg-slate-800 transition ${activeTab === 'projects' ? 'bg-slate-800 text-blue-400 border-l-4 border-blue-500' : ''}`}><FileText size={20} /> <span className="hidden md:inline">Proyek Berjalan</span></button>
          <button onClick={() => setActiveTab('finished')} className={`flex items-center gap-3 w-full p-4 hover:bg-slate-800 transition ${activeTab === 'finished' ? 'bg-slate-800 text-purple-400 border-l-4 border-purple-500' : ''}`}><ShieldCheck size={20} /> <span className="hidden md:inline">Purna Jual & Garansi</span></button>
          <button onClick={() => setActiveTab('schedules')} className={`flex items-center gap-3 w-full p-4 hover:bg-slate-800 transition ${activeTab === 'schedules' ? 'bg-slate-800 text-blue-400 border-l-4 border-blue-500' : ''}`}>
            <div className="relative">
              <Calendar size={20} />
              {notifications.length > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500"></span>}
            </div>
            <span className="hidden md:inline">Jadwal Tim</span>
          </button>
        </div>
        <div className="p-4 border-t border-slate-700">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full p-3 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition"><LogOut size={20} /> <span className="hidden md:inline">Keluar</span></button>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'clients' && <ClientView />}
          {activeTab === 'projects' && <ProjectView />}
          {activeTab === 'finished' && <FinishedProjectView />}
          {activeTab === 'schedules' && <ScheduleView />}
        </div>
      </main>
    </div>
  );
}
