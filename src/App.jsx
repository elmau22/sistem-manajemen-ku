import React, { useState, useEffect } from 'react';
import { 
  Users, Calendar, Briefcase, LayoutDashboard, Mail, MessageCircle, 
  Plus, CheckCircle, Clock, Lock, LogOut, Bell, FileText, Edit, X, 
  AlertTriangle, Trash2, ShieldCheck, Award, DollarSign, BarChart3, 
  Download, Upload, MessageSquare, Paperclip, Activity, Settings
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged 
} from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- KONFIGURASI FIREBASE ---
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
const storage = getStorage(app);
const appId = 'sys-manage-app-corp'; // App ID untuk kolaborasi tim (Data Publik bersama)

export default function App() {
  // --- STATES UTAMA ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Menyimpan detail role pengguna
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  // Auth Form
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authRole, setAuthRole] = useState('admin'); // Default diubah menjadi admin
  const [inviteCompanyId, setInviteCompanyId] = useState(''); // Menyimpan ID Perusahaan dari link
  const [authError, setAuthError] = useState('');

  // Data Perusahaan
  const [teamMembers, setTeamMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Modals & UI States
  const [editingProject, setEditingProject] = useState(null);
  const [projectReport, setProjectReport] = useState('');
  const [newProgress, setNewProgress] = useState(0);
  const [projectDetailsModal, setProjectDetailsModal] = useState(null); // Modal detail & diskusi
  const [newComment, setNewComment] = useState('');

  // --- CEK LINK UNDANGAN (URL PARAMS) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteRole = params.get('role');
    const inviteCompany = params.get('company');
    if (inviteRole && inviteCompany) {
      setIsLoginMode(false);
      setAuthRole(inviteRole);
      setInviteCompanyId(inviteCompany);
    }
  }, []);

  // --- SINKRONISASI AUTENTIKASI & DATABASE ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserProfile(null);
        setIsLoadingAuth(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Tarik Profil Global User
  useEffect(() => {
    if (!user) return;
    const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'global_users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
      setIsLoadingAuth(false);
    });
    return () => unsubProfile();
  }, [user]);

  // Data Kolaborasi Per Perusahaan (Workspace)
  useEffect(() => {
    if (!userProfile || !userProfile.companyId) return;
    const compId = userProfile.companyId;

    const unsubTeam = onSnapshot(collection(db, 'artifacts', appId, 'companies', compId, 'users'), (snapshot) => {
      setTeamMembers(snapshot.docs.map(doc => doc.data()));
    });

    const unsubClients = onSnapshot(collection(db, 'artifacts', appId, 'companies', compId, 'clients'), (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubProjects = onSnapshot(collection(db, 'artifacts', appId, 'companies', compId, 'projects'), (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubSchedules = onSnapshot(collection(db, 'artifacts', appId, 'companies', compId, 'schedules'), (snapshot) => {
      const scheduleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSchedules(scheduleData);
      const today = new Date().toISOString().split('T')[0];
      setNotifications(scheduleData.filter(s => s.status === 'Pending' && s.date <= today));
    });

    const unsubLogs = onSnapshot(collection(db, 'artifacts', appId, 'companies', compId, 'logs'), (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivityLogs(logs.sort((a, b) => b.timestamp - a.timestamp)); 
    });

    return () => { unsubTeam(); unsubClients(); unsubProjects(); unsubSchedules(); unsubLogs(); };
  }, [userProfile]);

  // --- FUNGSI UTILITAS: LOGGER & HAK AKSES ---
  const logActivity = async (actionDesc) => {
    if(!userProfile) return;
    try {
      const userDisplayName = userProfile.name || user.email;
      await addDoc(collection(db, 'artifacts', appId, 'companies', userProfile.companyId, 'logs'), {
        user: userDisplayName,
        role: userProfile.role || 'Unknown',
        action: actionDesc,
        timestamp: Date.now()
      });
    } catch (e) { console.error("Log error:", e); }
  };

  const hasAccess = (allowedRoles) => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin' || userProfile.role === 'pimpinan') return true; // Akses dewa
    return allowedRoles.includes(userProfile.role);
  };

  // --- FUNGSI AUTENTIKASI ---
  const handleAuthentication = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        const uid = userCred.user.uid;
        
        // Jika tanpa undangan, user adalah Admin dan ID Perusahaannya adalah UID-nya sendiri
        const assignedCompanyId = inviteCompanyId ? inviteCompanyId : uid; 
        
        const newProfile = {
          uid: uid,
          email: authEmail,
          name: authName || authEmail.split('@')[0],
          role: authRole,
          companyId: assignedCompanyId,
          joinedAt: Date.now()
        };

        // Simpan ke registrasi global
        await setDoc(doc(db, 'artifacts', appId, 'global_users', uid), newProfile);
        // Simpan ke dalam ruang kerja perusahaan
        await setDoc(doc(db, 'artifacts', appId, 'companies', assignedCompanyId, 'users', uid), newProfile);

        alert(`Berhasil mendaftar sebagai ${authRole.replace('_', ' ').toUpperCase()}!`);
      }
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') setAuthError('Email ini sudah terdaftar.');
      else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') setAuthError('Email atau Password salah.');
      else setAuthError('Terjadi kesalahan. Pastikan format email benar.');
    }
  };

  const handleLogout = async () => {
    try { 
      await signOut(auth); 
      setActiveTab('dashboard'); 
    } catch (error) { 
      console.error(error); 
    }
  };

  const generateInviteLink = (role) => {
    const companyId = userProfile.companyId;
    const link = `${window.location.origin}${window.location.pathname}?role=${role}&company=${companyId}`;
    navigator.clipboard.writeText(link).catch(() => {
      const el = document.createElement('textarea');
      el.value = link;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    alert(`Link Undangan untuk role ${role.toUpperCase()} berhasil disalin ke Clipboard! Kirim ke anggota tim.`);
  };

  // --- FUNGSI AKSI DATA ---
  const addClient = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const clientName = formData.get('name');
    try {
      await addDoc(collection(db, 'artifacts', appId, 'companies', userProfile.companyId, 'clients'), {
        name: clientName,
        company: formData.get('company'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        status: formData.get('status'),
        createdAt: Date.now()
      });
      logActivity(`Menambahkan prospek/klien baru: ${clientName}`);
      e.target.reset();
    } catch (error) { console.error(error); }
  };

  const addProject = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const projectName = formData.get('name');
    const assignees = Array.from(formData.getAll('assignees')); // Multi select
    const budget = Number(formData.get('budget')) || 0;
    const isAutoSchedule = formData.get('autoSchedule') === 'on';
    const startDateStr = formData.get('startDate');
    const endDateStr = formData.get('endDate');

    try {
      await addDoc(collection(db, 'artifacts', appId, 'companies', userProfile.companyId, 'projects'), {
        name: projectName,
        client: formData.get('client'),
        startDate: startDateStr,
        endDate: endDateStr,
        budget: budget,
        paymentStatus: 'Belum Bayar', // Default
        progress: 0,
        status: 'On Going',
        lastReport: 'Proyek baru dimulai.',
        assignees: assignees,
        comments: [], // Array komentar internal
        files: [], // Array URL file
        createdAt: Date.now()
      });

      // Jadwal Otomatis
      if (isAutoSchedule) {
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);

        if (start && end && end > start) {
          const totalDays = (end - start) / (1000 * 60 * 60 * 24);
          
          const midPoint = new Date(start.getTime() + (totalDays / 2) * 24 * 60 * 60 * 1000);
          const testPoint = new Date(start.getTime() + (totalDays * 0.8) * 24 * 60 * 60 * 1000);

          const scheduleRef = collection(db, 'artifacts', appId, 'companies', userProfile.companyId, 'schedules');

          await addDoc(scheduleRef, {
            task: `[${projectName}] Desain UI/UX & Pemrograman`,
            date: midPoint.toISOString().split('T')[0],
            team: 'Tim Dev & UI/UX',
            status: 'Pending',
            createdAt: Date.now()
          });

          await addDoc(scheduleRef, {
            task: `[${projectName}] Testing & QA`,
            date: testPoint.toISOString().split('T')[0],
            team: 'Tim QA',
            status: 'Pending',
            createdAt: Date.now() + 1
          });

          await addDoc(scheduleRef, {
            task: `[${projectName}] Publish & Serah Terima`,
            date: end.toISOString().split('T')[0],
            team: 'Manajer Proyek',
            status: 'Pending',
            createdAt: Date.now() + 2
          });
        }
      }

      logActivity(`Membuat proyek baru: ${projectName} bernilai Rp ${budget.toLocaleString()}`);
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
      await updateDoc(doc(db, 'artifacts', appId, 'companies', userProfile.companyId, 'projects', editingProject.id), {
        progress: numProg,
        status: newStatus,
        lastReport: projectReport,
        updatedAt: Date.now()
      });
      logActivity(`Memperbarui progres proyek ${editingProject.name} menjadi ${numProg}%`);
      setEditingProject(null);
      setProjectReport('');
      setNewProgress(0);
    } catch (error) { console.error(error); }
  };

  const handleFileUpload = async (e, projectId, projectName) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      alert("Mengunggah berkas... Mohon tunggu.");
      const storageRef = ref(storage, `proyek_files/${projectId}_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      const projectDoc = projects.find(p => p.id === projectId);
      const currentFiles = projectDoc.files || [];
      
      await updateDoc(doc(db, 'artifacts', appId, 'companies', userProfile.companyId, 'projects', projectId), {
        files: [...currentFiles, { name: file.name, url: url, uploadedAt: Date.now() }]
      });
      logActivity(`Mengunggah berkas ${file.name} ke proyek ${projectName}`);
      alert("Berkas berhasil diunggah!");
    } catch (error) {
      console.error(error);
      alert("Gagal mengunggah! Pastikan Firebase Storage sudah diaktifkan di Console Anda.");
    }
  };

  const addComment = async (e, projectId) => {
    e.preventDefault();
    if(!newComment.trim()) return;
    try {
      const projectDoc = projects.find(p => p.id === projectId);
      const currentComments = projectDoc.comments || [];
      const commentObj = {
        id: Date.now(),
        user: userProfile.name,
        text: newComment,
        timestamp: Date.now()
      };
      await updateDoc(doc(db, 'artifacts', appId, 'companies', userProfile.companyId, 'projects', projectId), {
        comments: [...currentComments, commentObj]
      });
      logActivity(`Menambahkan komentar pada proyek ${projectDoc.name}`);
      setNewComment('');
    } catch (e) { console.error(e); }
  };

  const updatePaymentStatus = async (projectId, newStatus, projectName) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'companies', userProfile.companyId, 'projects', projectId), {
        paymentStatus: newStatus
      });
      logActivity(`Mengubah status pembayaran proyek ${projectName} menjadi ${newStatus}`);
    } catch(e) { console.error(e); }
  };

  const exportToCSV = (dataList, fileName) => {
    if (dataList.length === 0) return alert("Data kosong");
    const headers = Object.keys(dataList[0]).filter(k => typeof dataList[0][k] !== 'object').join(',');
    const rows = dataList.map(obj => 
      Object.keys(obj).filter(k => typeof obj[k] !== 'object')
        .map(k => `"${String(obj[k]).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + '\n' + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    logActivity(`Mengekspor data ${fileName} ke CSV`);
  };

  // --- KOMPONEN TAMPILAN ---

  const DashboardView = () => {
    const totalPendapatan = projects.filter(p => p.paymentStatus === 'Lunas').reduce((sum, p) => sum + (p.budget || 0), 0);
    const potensiPendapatan = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Dashboard Utama</h2>
        
        {/* Ringkasan Angka */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl shadow border-l-4 border-blue-500">
            <p className="text-sm text-gray-500 font-medium mb-1">Total Klien Aktif</p>
            <h3 className="text-2xl font-bold text-gray-800">{clients.filter(c=>c.status==='Klien Aktif').length}</h3>
          </div>
          <div className="bg-white p-5 rounded-xl shadow border-l-4 border-orange-500">
            <p className="text-sm text-gray-500 font-medium mb-1">Proyek On Going</p>
            <h3 className="text-2xl font-bold text-gray-800">{projects.filter(p=>p.status!=='Finish').length}</h3>
          </div>
          {hasAccess(['manajer_finance', 'manajer_marketing', 'admin', 'pimpinan']) && (
            <>
              <div className="bg-white p-5 rounded-xl shadow border-l-4 border-green-500">
                <p className="text-sm text-gray-500 font-medium mb-1">Pendapatan Masuk (Lunas)</p>
                <h3 className="text-xl font-bold text-gray-800">Rp {totalPendapatan.toLocaleString('id-ID')}</h3>
              </div>
              <div className="bg-white p-5 rounded-xl shadow border-l-4 border-yellow-500">
                <p className="text-sm text-gray-500 font-medium mb-1">Potensi / Piutang Berjalan</p>
                <h3 className="text-xl font-bold text-gray-800">Rp {(potensiPendapatan - totalPendapatan).toLocaleString('id-ID')}</h3>
              </div>
            </>
          )}
        </div>

        {/* Akses Admin: Link Generator */}
        {hasAccess(['admin', 'pimpinan']) && (
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
            <h3 className="font-bold text-indigo-800 flex items-center mb-3"><Users size={18} className="mr-2"/> Generator Link Undangan Tim</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={()=>generateInviteLink('manajer_proyek')} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700">Link Manajer Proyek</button>
              <button onClick={()=>generateInviteLink('anggota_proyek')} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">Link Anggota Proyek</button>
              <button onClick={()=>generateInviteLink('manajer_marketing')} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-700">Link Manajer Marketing</button>
              <button onClick={()=>generateInviteLink('manajer_finance')} className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded hover:bg-amber-700">Link Manajer Finance</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ClientView = () => {
    if (!hasAccess(['manajer_marketing', 'anggota_marketing', 'admin', 'pimpinan'])) return <div className="p-8 text-center text-gray-500">Anda tidak memiliki hak akses Manajemen Marketing.</div>;
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Manajemen Klien & Prospek</h2>
          <button onClick={() => exportToCSV(clients, 'Data_Klien')} className="flex items-center gap-2 text-sm bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700"><Download size={16}/> Export CSV</button>
        </div>
        {/* Form Tambah Klien (Hanya Manajer/Admin) */}
        {hasAccess(['manajer_marketing', 'admin', 'pimpinan']) && (
          <form onSubmit={addClient} className="bg-white p-5 rounded-xl shadow-sm border flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[150px]"><label className="block text-xs font-semibold mb-1">Nama</label><input required name="name" className="w-full border rounded p-2 text-sm" /></div>
            <div className="flex-1 min-w-[150px]"><label className="block text-xs font-semibold mb-1">Perusahaan</label><input required name="company" className="w-full border rounded p-2 text-sm" /></div>
            <div className="flex-1 min-w-[150px]"><label className="block text-xs font-semibold mb-1">WhatsApp</label><input required name="phone" className="w-full border rounded p-2 text-sm" placeholder="628..." /></div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-semibold mb-1">Status Prospek</label>
              <select required name="status" className="w-full border rounded p-2 text-sm">
                <option value="Prospek">Prospek</option>
                <option value="Hot Prospek">🔥 Hot Prospek</option>
                <option value="Klien Aktif">✅ Klien Aktif</option>
              </select>
            </div>
            <button type="submit" className="bg-blue-600 text-white px-5 py-2 text-sm rounded flex items-center"><Plus size={16} className="mr-1"/> Tambah</button>
          </form>
        )}
        {/* Tabel Klien */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100"><tr><th className="p-3">Info Klien</th><th className="p-3">Kontak</th><th className="p-3">Status</th><th className="p-3">Aksi</th></tr></thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{c.name}<br/><span className="text-gray-500 font-normal">{c.company}</span></td>
                  <td className="p-3">{c.phone}<br/>{c.email}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${c.status.includes('Hot') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>{c.status}</span></td>
                  <td className="p-3">
                    <button onClick={() => window.open(`https://wa.me/${c.phone}`, '_blank')} className="bg-green-100 text-green-700 p-1.5 rounded mr-2"><MessageCircle size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const ProjectView = () => {
    if (!hasAccess(['manajer_proyek', 'anggota_proyek', 'manajer_marketing', 'manajer_finance', 'admin', 'pimpinan'])) return <div className="p-8 text-center text-gray-500">Akses Ditolak.</div>;
    
    // Filter proyek: Anggota hanya melihat proyek yang ditugaskan ke mereka (kecuali Admin/Manajer)
    const isMember = userProfile.role.includes('anggota');
    const myProjects = isMember ? projects.filter(p => p.assignees?.includes(userProfile.uid)) : projects;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Manajemen Proyek Operasional</h2>
          {hasAccess(['admin', 'pimpinan']) && <button onClick={() => exportToCSV(projects, 'Data_Proyek')} className="flex items-center gap-2 text-sm bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700"><Download size={16}/> Export Proyek</button>}
        </div>

        {/* Buat Proyek Baru (Hanya Manajer Proyek / Admin) */}
        {hasAccess(['manajer_proyek', 'admin', 'pimpinan']) && (
          <form onSubmit={addProject} className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2"><label className="block text-xs font-semibold mb-1">Nama Proyek</label><input required name="name" className="w-full border rounded p-2" /></div>
            <div className="md:col-span-2"><label className="block text-xs font-semibold mb-1">Pilih Klien</label>
              <select name="client" className="w-full border rounded p-2" required>
                <option value="">-- Pilih --</option>
                {clients.map(c => <option key={c.id} value={c.name}>{c.name} ({c.company})</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-semibold mb-1">Tgl Mulai</label><input required type="date" name="startDate" className="w-full border rounded p-2" /></div>
            <div><label className="block text-xs font-semibold mb-1">Target Selesai</label><input required type="date" name="endDate" className="w-full border rounded p-2" /></div>
            <div className="md:col-span-2"><label className="block text-xs font-semibold mb-1">Tugaskan Anggota (Tahan Ctrl untuk multi-pilih)</label>
              <select name="assignees" multiple className="w-full border rounded p-2 h-20 text-sm" required>
                {teamMembers.filter(m => m.role.includes('proyek')).map(m => (
                  <option key={m.uid} value={m.uid}>{m.name} ({m.role.replace('_',' ')})</option>
                ))}
              </select>
            </div>
            {hasAccess(['manajer_finance', 'admin', 'pimpinan']) && (
              <div className="md:col-span-2"><label className="block text-xs font-semibold mb-1">Nilai Kontrak / Budget (Rp)</label><input type="number" name="budget" defaultValue="0" className="w-full border rounded p-2" /></div>
            )}
            <div className="md:col-span-4 flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="autoSchedule" defaultChecked className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-medium text-blue-900">Buat Jadwal Tim Otomatis (UI/UX, Testing, Publish)</span>
              </label>
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded flex items-center text-sm font-bold shadow-md hover:bg-blue-700"><Plus size={16} className="mr-2"/> Terbitkan Proyek</button>
            </div>
          </form>
        )}

        {/* List Proyek */}
        <div className="grid grid-cols-1 gap-4">
          {myProjects.map(p => {
            const teamNames = p.assignees?.map(uid => teamMembers.find(t => t.uid === uid)?.name || 'Unknown').join(', ');
            return (
              <div key={p.id} className="bg-white border rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start border-b pb-3 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{p.name}</h3>
                    <p className="text-sm text-gray-500"><Users size={14} className="inline mr-1"/> Klien: {p.client} | Tim: <span className="font-medium text-indigo-600">{teamNames}</span></p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${p.status === 'Finish' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{p.status} ({p.progress}%)</span>
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex-1 mr-6">
                    <p className="text-xs text-gray-500 mb-1">Tenggat Waktu: <strong className="text-red-500">{p.endDate}</strong></p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1"><div className="h-2 rounded-full bg-blue-500" style={{width: `${p.progress}%`}}></div></div>
                    <p className="text-xs text-gray-600 italic">"{p.lastReport}"</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setProjectDetailsModal(p)} className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded text-sm hover:bg-indigo-100 font-medium flex items-center"><MessageSquare size={16} className="mr-1"/> Diskusi & File</button>
                    {(hasAccess(['manajer_proyek', 'anggota_proyek', 'admin', 'pimpinan']) && p.status !== 'Finish') && (
                      <button onClick={() => {setEditingProject(p); setNewProgress(p.progress);}} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200 font-medium flex items-center"><Edit size={16} className="mr-1"/> Update Progress</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Update Progres */}
        {editingProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="font-bold text-lg mb-4">Update Laporan: {editingProject.name}</h3>
              <form onSubmit={updateProjectProgress} className="space-y-4">
                <div><label className="text-sm">Progres Baru (%)</label><input type="number" min="0" max="100" value={newProgress} onChange={e=>setNewProgress(e.target.value)} className="w-full border p-2 rounded mt-1" required /></div>
                <div><label className="text-sm">Bukti/Laporan Pengerjaan</label><textarea rows="3" value={projectReport} onChange={e=>setProjectReport(e.target.value)} className="w-full border p-2 rounded mt-1" required></textarea></div>
                <div className="flex gap-2 justify-end mt-4">
                  <button type="button" onClick={() => setEditingProject(null)} className="px-4 py-2 bg-gray-100 rounded">Batal</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Simpan Laporan</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Ruang Diskusi & File (Detail Proyek) */}
        {projectDetailsModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
              <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center"><Briefcase className="mr-2"/> Ruang Kerja: {projectDetailsModal.name}</h3>
                <button onClick={() => setProjectDetailsModal(null)} className="hover:text-red-400"><X/></button>
              </div>
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Bagian Berkas */}
                <div className="w-full md:w-1/3 bg-gray-50 border-r p-4 overflow-y-auto">
                  <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center border-b pb-2"><Paperclip size={16} className="mr-2"/> Berkas Proyek (PDF/JPG)</h4>
                  <div className="space-y-2 mb-4">
                    {projectDetailsModal.files?.map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noreferrer" className="block p-2 bg-white border rounded text-xs text-blue-600 hover:bg-blue-50 truncate flex items-center"><FileText size={14} className="mr-1 shrink-0"/> {f.name}</a>
                    ))}
                    {(!projectDetailsModal.files || projectDetailsModal.files.length === 0) && <p className="text-xs text-gray-400 italic">Belum ada berkas diunggah.</p>}
                  </div>
                  <label className="block w-full text-center p-3 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:bg-gray-100 transition">
                    <span className="text-xs font-semibold text-gray-600"><Upload size={16} className="mx-auto mb-1"/> Unggah Berkas Baru</span>
                    <input type="file" className="hidden" accept=".pdf, image/jpeg, image/png" onChange={(e) => {handleFileUpload(e, projectDetailsModal.id, projectDetailsModal.name); setProjectDetailsModal(null);}} />
                  </label>
                  <p className="text-[10px] text-gray-400 mt-2 text-center">*Maks 5MB. Memerlukan Storage Aktif.</p>
                </div>
                
                {/* Bagian Komentar / Diskusi Internal */}
                <div className="flex-1 flex flex-col p-4 bg-white">
                  <h4 className="font-bold text-sm text-gray-700 mb-3 border-b pb-2 flex items-center"><MessageCircle size={16} className="mr-2"/> Forum Diskusi Tim</h4>
                  <div className="flex-1 overflow-y-auto space-y-3 p-2 bg-slate-50 rounded-lg mb-3">
                    {projectDetailsModal.comments?.map(c => (
                      <div key={c.id} className={`p-3 rounded-lg max-w-[85%] shadow-sm ${c.user === userProfile?.name ? 'bg-indigo-100 ml-auto' : 'bg-white border'}`}>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-xs font-bold text-gray-800">{c.user}</span>
                          <span className="text-[10px] text-gray-500">{new Date(c.timestamp).toLocaleTimeString('id-ID')}</span>
                        </div>
                        <p className="text-sm text-gray-700">{c.text}</p>
                      </div>
                    ))}
                    {(!projectDetailsModal.comments || projectDetailsModal.comments.length === 0) && <p className="text-sm text-gray-400 text-center mt-10">Mulai diskusi pertama untuk proyek ini.</p>}
                  </div>
                  <form onSubmit={(e) => { addComment(e, projectDetailsModal.id); setProjectDetailsModal({...projectDetailsModal, comments: [...(projectDetailsModal.comments||[]), {id:Date.now(), user:userProfile.name, text:newComment, timestamp:Date.now()}]}) }} className="flex gap-2">
                    <input type="text" value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="Ketik pesan..." className="flex-1 border rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500" required/>
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-700">Kirim</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const FinanceView = () => {
    if (!hasAccess(['manajer_finance', 'admin', 'pimpinan'])) return <div className="p-8 text-center text-gray-500">Akses khusus Manajemen Keuangan.</div>;
    
    const sendInvoiceWA = (clientName, projectName, budget, status) => {
      const cData = clients.find(c => c.name === clientName);
      if(!cData) return alert("Data kontak klien tidak ditemukan");
      let msg = `Yth. Bpk/Ibu ${clientName},\nIni adalah pengingat tagihan untuk proyek *${projectName}* sebesar *Rp ${budget.toLocaleString('id-ID')}*.\nStatus saat ini: *${status}*.\nMohon segera memproses pembayaran. Terima kasih.`;
      if(status === 'Lunas') msg = `Yth. Bpk/Ibu ${clientName},\nTerima kasih, pembayaran untuk proyek *${projectName}* telah kami terima dan dinyatakan *LUNAS*.\nSalam hangat.`;
      window.open(`https://wa.me/${cData.phone}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center"><DollarSign className="mr-2 text-green-600"/> Manajemen Invoicing & Keuangan</h2>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100"><tr><th className="p-3">Proyek & Klien</th><th className="p-3">Nilai Kontrak</th><th className="p-3">Status Tagihan</th><th className="p-3">Tindakan Cepat</th></tr></thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">{p.name}<br/><span className="text-gray-500 text-xs">{p.client}</span></td>
                  <td className="p-3 font-bold text-gray-700">Rp {(p.budget || 0).toLocaleString('id-ID')}</td>
                  <td className="p-3">
                    <select value={p.paymentStatus || 'Belum Bayar'} onChange={(e) => updatePaymentStatus(p.id, e.target.value, p.name)} className={`p-1.5 rounded text-xs font-bold ${p.paymentStatus==='Lunas'?'bg-green-100 text-green-700':p.paymentStatus==='DP'?'bg-yellow-100 text-yellow-700':'bg-red-100 text-red-700'}`}>
                      <option value="Belum Bayar">Belum Bayar</option>
                      <option value="DP">Terbayar Sebagian (DP)</option>
                      <option value="Lunas">LUNAS</option>
                    </select>
                  </td>
                  <td className="p-3 flex gap-2">
                    <button onClick={()=>sendInvoiceWA(p.client, p.name, p.budget||0, p.paymentStatus)} className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded text-xs hover:bg-emerald-200 font-medium flex items-center"><MessageCircle size={14} className="mr-1"/> Kirim WA</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const ReportView = () => {
    if (!hasAccess(['pimpinan', 'admin'])) return <div className="p-8 text-center text-gray-500">Akses khusus Pimpinan Perusahaan.</div>;
    
    // Logika Chart Sederhana (Bulan Ini vs Bulan Lalu)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const finishedProjects = projects.filter(p => p.status === 'Finish');
    
    const thisMonthCount = finishedProjects.filter(p => { const d = new Date(p.updatedAt || p.createdAt); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).length;
    const lastMonthCount = finishedProjects.filter(p => { const d = new Date(p.updatedAt || p.createdAt); return d.getMonth() === (currentMonth - 1 === -1 ? 11 : currentMonth - 1) && d.getFullYear() === (currentMonth === 0 ? currentYear - 1 : currentYear); }).length;
    
    const maxVal = Math.max(thisMonthCount, lastMonthCount, 5); // Minimum skala 5
    const thisMonthHeight = (thisMonthCount / maxVal) * 100;
    const lastMonthHeight = (lastMonthCount / maxVal) * 100;

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center"><BarChart3 className="mr-2 text-purple-600"/> Laporan & Audit Sistem</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Grafik Kinerja */}
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Performa Penyelesaian Proyek</h3>
            <div className="flex items-end justify-center h-48 gap-8 mt-6">
              <div className="flex flex-col items-center group">
                <div className="w-16 bg-gray-300 rounded-t-md relative transition-all duration-500" style={{height: `${lastMonthHeight}%`}}>
                  <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 font-bold text-gray-600">{lastMonthCount}</span>
                </div>
                <span className="text-sm mt-2 font-medium text-gray-500">Bulan Lalu</span>
              </div>
              <div className="flex flex-col items-center group">
                <div className="w-16 bg-purple-600 rounded-t-md relative transition-all duration-500 shadow-lg" style={{height: `${thisMonthHeight}%`}}>
                  <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 font-bold text-purple-700">{thisMonthCount}</span>
                </div>
                <span className="text-sm mt-2 font-bold text-purple-700">Bulan Ini</span>
              </div>
            </div>
          </div>

          {/* Log Aktivitas Karyawan */}
          <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col h-full max-h-80">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-gray-700 flex items-center"><Activity size={18} className="mr-2"/> Jejak Aktivitas Tim</h3>
              <button onClick={() => exportToCSV(activityLogs, 'Log_Aktivitas')} className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300">Export Log</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {activityLogs.slice(0, 50).map(log => (
                <div key={log.id} className="text-sm bg-slate-50 p-2 rounded border-l-2 border-indigo-400">
                  <p className="text-gray-800"><span className="font-bold">{log.user}</span> <span className="text-gray-500 text-[10px]">({log.role})</span></p>
                  <p className="text-gray-600 text-xs my-0.5">{log.action}</p>
                  <p className="text-gray-400 text-[10px]">{new Date(log.timestamp).toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ScheduleView = () => {
    if (!hasAccess(['manajer_proyek', 'anggota_proyek', 'admin', 'pimpinan'])) return <div className="p-8 text-center text-gray-500">Akses Ditolak.</div>;

    const toggleStatus = async (item) => {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'companies', userProfile.companyId, 'schedules', item.id), {
          status: item.status === 'Selesai' ? 'Pending' : 'Selesai'
        });
        logActivity(`Mengubah status jadwal: ${item.task} menjadi ${item.status === 'Selesai' ? 'Pending' : 'Selesai'}`);
      } catch (error) { console.error(error); }
    };

    const addSchedule = async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      try {
        await addDoc(collection(db, 'artifacts', appId, 'companies', userProfile.companyId, 'schedules'), {
          task: formData.get('task'),
          date: formData.get('date'),
          team: formData.get('team'),
          status: 'Pending',
          createdAt: Date.now()
        });
        logActivity(`Menambahkan agenda baru: ${formData.get('task')}`);
        e.target.reset();
      } catch (error) { console.error(error); }
    };

    const sortedSchedules = [...schedules].sort((a, b) => new Date(a.date) - new Date(b.date));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center"><Calendar className="mr-2 text-blue-600"/> Kalender & Tugas Tim</h2>
        
        {hasAccess(['manajer_proyek', 'admin', 'pimpinan']) && (
          <form onSubmit={addSchedule} className="bg-white p-5 rounded-xl shadow-sm border flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]"><label className="block text-xs font-semibold mb-1">Tugas</label><input required name="task" className="w-full border rounded p-2 text-sm" /></div>
            <div className="flex-1 min-w-[150px]"><label className="block text-xs font-semibold mb-1">Tanggal</label><input required type="date" name="date" className="w-full border rounded p-2 text-sm" /></div>
            <div className="flex-1 min-w-[150px]"><label className="block text-xs font-semibold mb-1">Tim Bertugas</label><input required name="team" className="w-full border rounded p-2 text-sm" placeholder="Contoh: Tim Dev" /></div>
            <button type="submit" className="bg-blue-600 text-white px-5 py-2 text-sm rounded flex items-center hover:bg-blue-700"><Plus size={16} className="mr-1" /> Tambah Agenda</button>
          </form>
        )}

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden relative">
          {sortedSchedules.map(schedule => {
            const isToday = schedule.date === new Date().toISOString().split('T')[0];
            const isOverdue = schedule.date < new Date().toISOString().split('T')[0] && schedule.status !== 'Selesai';

            return (
            <div key={schedule.id} className={`flex items-center justify-between p-4 border-b transition ${isToday ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center gap-4">
                <button onClick={() => toggleStatus(schedule)} className={schedule.status === 'Selesai' ? 'text-green-500' : 'text-gray-300 hover:text-green-400'}><CheckCircle size={24} /></button>
                <div>
                  <h4 className={`font-semibold text-sm ${schedule.status === 'Selesai' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {schedule.task}
                    {isToday && schedule.status !== 'Selesai' && <span className="ml-2 text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase">Hari Ini</span>}
                    {isOverdue && <span className="ml-2 text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full uppercase">Terlewat</span>}
                  </h4>
                  <div className="flex items-center text-xs gap-4 mt-1">
                    <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : 'text-gray-500'}`}><Clock size={12} /> {new Date(schedule.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span className="flex items-center gap-1 text-gray-500"><Users size={12} /> {schedule.team}</span>
                  </div>
                </div>
              </div>
            </div>
          )})}
          {sortedSchedules.length === 0 && <p className="text-center p-8 text-sm text-gray-400">Belum ada agenda tim.</p>}
        </div>
      </div>
    );
  };

  // --- KOMPONEN MANAJEMEN KARYAWAN ---
  const EmployeeManagementView = () => {
    // Hanya Admin dan Pimpinan yang bisa melihat dan mengubah
    if (!hasAccess(['admin', 'pimpinan'])) return <div className="p-8 text-center text-gray-500">Akses khusus Administrator.</div>;

    const [newEmpEmail, setNewEmpEmail] = useState('');
    const [newEmpName, setNewEmpName] = useState('');
    const [newEmpPassword, setNewEmpPassword] = useState('');
    const [newEmpRole, setNewEmpRole] = useState('anggota_proyek');
    const [isCreatingEmp, setIsCreatingEmp] = useState(false);

    const handleCreateEmployee = async (e) => {
      e.preventDefault();
      setIsCreatingEmp(true);
      try {
        // 1. Buat Akun Firebase Auth untuk karyawan (Perlu penanganan khusus jika admin sedang login)
        // Cara terbaik di frontend adalah Firebase akan otomatis meloginkan user baru ini, 
        // jadi kita simpan dulu kredensial admin saat ini, buat user, lalu login kembali sebagai admin.
        // *Alternatif lebih aman namun lebih kompleks adalah menggunakan Firebase Admin SDK di backend.*
        // Untuk simulasi ini, kita gunakan pendekatan langsung.
        
        const currentAdminEmail = user.email;
        // Prompt user untuk memasukkan ulang password admin (untuk login kembali nanti)
        const adminPassword = window.prompt(`Untuk alasan keamanan, masukkan kembali password Anda (${currentAdminEmail}) sebelum membuat akun karyawan:`);
        
        if(!adminPassword) {
           setIsCreatingEmp(false);
           return;
        }

        // Buat user baru (ini akan me-logout admin secara otomatis di background)
        const userCred = await createUserWithEmailAndPassword(auth, newEmpEmail, newEmpPassword);
        const newUid = userCred.user.uid;

        const newProfile = {
          uid: newUid,
          email: newEmpEmail,
          name: newEmpName,
          role: newEmpRole,
          companyId: userProfile.companyId,
          joinedAt: Date.now()
        };

        // Simpan data user baru ke DB
        await setDoc(doc(db, 'artifacts', appId, 'global_users', newUid), newProfile);
        await setDoc(doc(db, 'artifacts', appId, 'companies', userProfile.companyId, 'users', newUid), newProfile);

        logActivity(`Menambahkan karyawan baru: ${newEmpName} (${newEmpRole})`);
        
        // Kembalikan sesi login Admin
        await signInWithEmailAndPassword(auth, currentAdminEmail, adminPassword);

        alert(`Berhasil menambahkan karyawan ${newEmpName}. Silakan berikan email dan password kepada yang bersangkutan.`);
        setNewEmpEmail(''); setNewEmpName(''); setNewEmpPassword('');
        
      } catch (error) {
        console.error("Error membuat karyawan:", error);
        alert("Gagal menambahkan karyawan. " + error.message);
        // Jika gagal, pastikan admin tidak stuck ter-logout
      }
      setIsCreatingEmp(false);
    };

    const removeEmployee = async (employeeId, employeeName) => {
      const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus akses untuk karyawan: ${employeeName}?`);
      if (confirmDelete) {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'companies', userProfile.companyId, 'users', employeeId));
          logActivity(`Menghapus akses karyawan: ${employeeName}`);
          alert('Akses karyawan berhasil dihapus.');
        } catch (error) {
          console.error("Gagal menghapus karyawan:", error);
          alert('Gagal menghapus karyawan.');
        }
      }
    };

    const updateEmployeeRole = async (employeeId, newRole, employeeName) => {
      try {
        await updateDoc(doc(db, 'artifacts', appId, 'companies', userProfile.companyId, 'users', employeeId), {
          role: newRole
        });
        logActivity(`Mengubah peran ${employeeName} menjadi ${newRole}`);
      } catch (error) {
        console.error("Gagal mengubah peran:", error);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center"><Settings className="mr-2 text-slate-600"/> Manajemen Karyawan & Akses</h2>
        </div>

        {/* Form Tambah Karyawan Manual */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-indigo-100">
            <h3 className="text-lg font-bold text-indigo-800 mb-3 flex items-center"><Plus size={18} className="mr-2"/> Daftarkan Karyawan Baru</h3>
            <p className="text-xs text-gray-500 mb-4">Buat akun untuk tim Anda secara manual. Karyawan tinggal login menggunakan kredensial ini tanpa perlu mendaftar.</p>
            <form onSubmit={handleCreateEmployee} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="md:col-span-1"><label className="block text-xs font-bold mb-1">Nama</label><input required type="text" value={newEmpName} onChange={e=>setNewEmpName(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Nama..." /></div>
                <div className="md:col-span-1"><label className="block text-xs font-bold mb-1">Email</label><input required type="email" value={newEmpEmail} onChange={e=>setNewEmpEmail(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Email..." /></div>
                <div className="md:col-span-1"><label className="block text-xs font-bold mb-1">Password</label><input required type="password" value={newEmpPassword} onChange={e=>setNewEmpPassword(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Minimal 6 kar..." /></div>
                <div className="md:col-span-1">
                    <label className="block text-xs font-bold mb-1">Peran Akses</label>
                    <select value={newEmpRole} onChange={e=>setNewEmpRole(e.target.value)} className="w-full border rounded p-2 text-sm bg-white">
                        <option value="admin">Admin</option>
                        <option value="manajer_proyek">Manajer Proyek</option>
                        <option value="anggota_proyek">Anggota Proyek</option>
                        <option value="manajer_marketing">Manajer Marketing</option>
                        <option value="anggota_marketing">Anggota Marketing</option>
                        <option value="manajer_finance">Finance</option>
                    </select>
                </div>
                <div className="md:col-span-1">
                    <button type="submit" disabled={isCreatingEmp} className={`w-full text-white font-bold py-2 rounded shadow transition ${isCreatingEmp ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        {isCreatingEmp ? 'Memproses...' : 'Buat Akun'}
                    </button>
                </div>
            </form>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 bg-slate-50 border-b">
            <p className="text-sm text-gray-600">Daftar semua anggota yang tergabung dalam ruang kerja (workspace) perusahaan ini. Anda dapat mengubah peran atau menghapus akses mereka dari sini.</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">Nama & Email</th>
                <th className="p-3">Peran Saat Ini</th>
                <th className="p-3">Bergabung Sejak</th>
                <th className="p-3">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map(member => (
                <tr key={member.uid} className="border-t hover:bg-gray-50">
                  <td className="p-3 font-medium">
                    {member.name}
                    {member.uid === user.uid && <span className="ml-2 bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] uppercase">Anda</span>}
                    <br/><span className="text-gray-500 font-normal text-xs">{member.email}</span>
                  </td>
                  <td className="p-3">
                    {member.uid === user.uid ? (
                      // Jangan izinkan pengguna mengubah perannya sendiri untuk mencegah terkunci dari sistem
                      <span className="px-2 py-1 rounded text-xs font-bold bg-slate-200 text-slate-700 uppercase">{member.role.replace('_', ' ')}</span>
                    ) : (
                      <select 
                        value={member.role} 
                        onChange={(e) => updateEmployeeRole(member.uid, e.target.value, member.name)}
                        className="p-1.5 border rounded text-xs font-bold uppercase bg-white cursor-pointer hover:border-indigo-400"
                      >
                        <option value="admin">Admin</option>
                        <option value="pimpinan">Pimpinan</option>
                        <option value="manajer_proyek">Manajer Proyek</option>
                        <option value="anggota_proyek">Anggota Proyek</option>
                        <option value="manajer_marketing">Manajer Marketing</option>
                        <option value="anggota_marketing">Anggota Marketing</option>
                        <option value="manajer_finance">Finance</option>
                      </select>
                    )}
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('id-ID') : '-'}
                  </td>
                  <td className="p-3">
                    {member.uid !== user.uid && (
                      <button 
                        onClick={() => removeEmployee(member.uid, member.name)}
                        className="bg-red-50 text-red-600 px-3 py-1.5 rounded text-xs hover:bg-red-100 font-medium flex items-center transition"
                        title="Cabut Akses Karyawan"
                      >
                        <Trash2 size={14} className="mr-1"/> Hapus Akses
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {teamMembers.length === 0 && (
                <tr><td colSpan="4" className="text-center p-8 text-gray-500">Memuat data karyawan...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // --- RENDER LAYOUT UTAMA ---
  if (isLoadingAuth) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><p className="text-white animate-pulse">Memuat Sistem ERP...</p></div>;

  if (!user || !userProfile) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 bg-cover bg-center" style={{backgroundImage: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)'}}>
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border-t-8 border-indigo-600">
          <div className="text-center mb-6">
            <div className="inline-block bg-indigo-100 p-4 rounded-full text-indigo-600 mb-3"><Briefcase size={36} /></div>
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">CORP-MANAGE ERP</h2>
            <p className="text-sm text-gray-500 font-medium">{isLoginMode ? 'Portal Masuk Karyawan' : 'Registrasi Ruang Kerja'}</p>
          </div>
          
          <form onSubmit={handleAuthentication} className="space-y-4">
            {!isLoginMode && (
              <div><label className="block text-xs font-bold text-gray-700 mb-1">Nama Lengkap</label><input type="text" value={authName} onChange={e=>setAuthName(e.target.value)} required className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50" placeholder="John Doe" /></div>
            )}
            <div><label className="block text-xs font-bold text-gray-700 mb-1">Email</label><input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} required className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50" placeholder="email@anda.com" /></div>
            <div><label className="block text-xs font-bold text-gray-700 mb-1">Password</label><input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} required className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50" placeholder="••••••••" /></div>
            
            {!isLoginMode && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-700">Anda akan mendaftar sebagai <strong>ADMINISTRATOR PERUSAHAAN</strong>. Ruang kerja eksklusif baru akan dibuat untuk Anda.</p>
              </div>
            )}

            {authError && <p className="text-red-600 text-xs font-medium bg-red-100 p-2 rounded text-center border border-red-200">{authError}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 transition shadow-lg mt-2 text-sm tracking-wide">
              {isLoginMode ? 'MASUK KE PORTAL' : 'BUAT RUANG KERJA'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs border-t pt-4 text-gray-500">
            {isLoginMode ? "Perusahaan Anda belum terdaftar? " : "Sudah punya akun? "}
            <button onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(''); }} className="text-indigo-600 font-bold hover:underline">
              {isLoginMode ? 'Buat Ruang Kerja' : 'Login di sini'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER SIDEBAR BERDASARKAN ROLE ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      <nav className="w-full md:w-64 bg-[#0f172a] text-slate-300 flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-slate-700/50 bg-[#1e293b]/50">
          <h1 className="text-xl font-extrabold text-white tracking-wider flex items-center gap-2"><Briefcase size={24} className="text-indigo-500" /> ERP SYSTEM</h1>
          <p className="text-sm font-medium mt-2 text-indigo-300">{userProfile?.name}</p>
          <p className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 inline-block px-2 py-0.5 rounded mt-1 border border-slate-600">{userProfile?.role.replace('_', ' ')}</p>
        </div>
        
        <div className="flex flex-row md:flex-col p-2 md:p-4 overflow-x-auto md:overflow-y-auto gap-1 flex-1 no-scrollbar">
          <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18} /> <span className="hidden md:inline">Dashboard</span></button>
          
          {hasAccess(['manajer_marketing', 'anggota_marketing', 'admin', 'pimpinan']) && (
            <button onClick={() => setActiveTab('clients')} className={`flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition ${activeTab === 'clients' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Users size={18} /> <span className="hidden md:inline">Manajemen Klien</span></button>
          )}
          
          {hasAccess(['manajer_proyek', 'anggota_proyek', 'manajer_marketing', 'manajer_finance', 'admin', 'pimpinan']) && (
            <button onClick={() => setActiveTab('projects')} className={`flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition ${activeTab === 'projects' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><FileText size={18} /> <span className="hidden md:inline">Proyek Berjalan</span></button>
          )}
          
          {hasAccess(['manajer_finance', 'admin', 'pimpinan']) && (
            <button onClick={() => setActiveTab('finance')} className={`flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition ${activeTab === 'finance' ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><DollarSign size={18} /> <span className="hidden md:inline">Keuangan / Invoicing</span></button>
          )}

          {hasAccess(['manajer_proyek', 'anggota_proyek', 'admin', 'pimpinan']) && (
            <button onClick={() => setActiveTab('schedules')} className={`flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition ${activeTab === 'schedules' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
              <div className="relative">
                <Calendar size={18} />
                {notifications.length > 0 && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500"></span>}
              </div>
              <span className="hidden md:inline">Jadwal Tim</span>
            </button>
          )}

          {hasAccess(['admin', 'pimpinan']) && (
            <button onClick={() => setActiveTab('employees')} className={`flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition ${activeTab === 'employees' ? 'bg-slate-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><Settings size={18} /> <span className="hidden md:inline">Pengaturan Karyawan</span></button>
          )}

          {hasAccess(['admin', 'pimpinan']) && (
            <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium transition ${activeTab === 'reports' ? 'bg-purple-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}><BarChart3 size={18} /> <span className="hidden md:inline">Laporan & Audit</span></button>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-700">
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 w-full p-2 text-xs font-bold text-red-400 border border-red-900/50 hover:bg-red-500 hover:text-white rounded-lg transition"><LogOut size={16} /> <span className="hidden md:inline">KELUAR PORTAL</span></button>
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'clients' && <ClientView />}
          {activeTab === 'projects' && <ProjectView />}
          {activeTab === 'finance' && <FinanceView />}
          {activeTab === 'schedules' && <ScheduleView />}
          {activeTab === 'employees' && <EmployeeManagementView />}
          {activeTab === 'reports' && <ReportView />}
        </div>
      </main>
    </div>
  );
}
