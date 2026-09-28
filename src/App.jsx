import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, orderBy, limit, documentId } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
const firebaseApp = firebaseEnabled ? (getApps()[0] || initializeApp(firebaseConfig)) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;
const appId = import.meta.env.VITE_BR_APP_ID || 'br-telecom';

const generateId = (prefix) => prefix + Date.now().toString().slice(-4) + Math.random().toString(36).substr(2, 6).toUpperCase();


const COMPANY_OPTIONS = [
  { id: 'we', name: 'WE', label: 'WE', tone: 'we' },
  { id: 'vodafone', name: 'Vodafone', label: 'Vodafone', tone: 'vodafone' },
  { id: 'etisalat', name: 'Etisalat', label: 'Etisalat', tone: 'etisalat' },
  { id: 'orange', name: 'Orange', label: 'Orange', tone: 'orange' },
];

const emptyCompanyData = () => ({
  customers: [], lines: [], packages: [], extraPackages: [], expenses: [], reservations: [], archives: [], activityLog: [], trashBin: []
});

const Surface = ({ children, className = '' }) => (
  <div className={`v16-surface ${className}`}>{children}</div>
);

const PageHeader = ({ title, description, actions, meta }) => (
  <div className="v16-page-header">
    <div>
      <div className="v16-page-kicker">BR Telecom</div>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    <div className="v16-page-header-side">
      {meta && <div className="v16-header-meta">{meta}</div>}
      {actions && <div className="v16-header-actions">{actions}</div>}
    </div>
  </div>
);

const FormSection = ({ title, subtitle, children, className = '' }) => (
  <Surface className={`v16-form-section ${className}`}>
    <div className="v16-section-heading">
      <div className="v16-section-dot"></div>
      <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
    </div>
    {children}
  </Surface>
);

const Field = ({ label, children, className = '' }) => (
  <div className={`v16-field ${className}`}><label>{label}</label>{children}</div>
);

const Status = ({ tone='neutral', children }) => <span className={`v16-status v16-status-${tone}`}>{children}</span>;
const IconButton = ({ children, tone='neutral', ...props }) => <button {...props} className={`v16-icon-btn v16-icon-${tone}`}>{children}</button>;
const EmptyState = ({ icon='○', title, text }) => (
  <div className="v16-empty"><div className="v16-empty-icon">{icon}</div><h3>{title}</h3>{text && <p>{text}</p>}</div>
);

export default function App() {
  const loadState = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  };

  const userCacheKey = (uid, key) => `br_user_${uid}_${key}`;
  const loadUserState = (uid, key, defaultVal) => {
    if (!uid) return defaultVal;
    try {
      const saved = localStorage.getItem(userCacheKey(uid, key));
      return saved ? JSON.parse(saved) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  };
  const saveUserState = (uid, key, value) => {
    if (!uid) return;
    try { localStorage.setItem(userCacheKey(uid, key), JSON.stringify(value)); } catch (_) {}
  };

  const [isArabic, setIsArabic] = useState(() => loadState('br_lang_ar', true));
  const [isDarkMode, setIsDarkMode] = useState(() => loadState('br_theme_dark', false));
  const [activeTab, setActiveTab] = useState('home'); // Set Home as default
  
  // Business data must never be shared between authenticated users through browser storage.
  // When Firebase is enabled, start empty and hydrate only after the current UID is known.
  const [customers, setCustomers] = useState(() => firebaseEnabled ? [] : loadState('br_customers', []));
  const [lines, setLines] = useState(() => firebaseEnabled ? [] : loadState('br_lines', []));
  const [packages, setPackages] = useState(() => firebaseEnabled ? [] : loadState('br_packages', []));
  const [extraPackages, setExtraPackages] = useState(() => firebaseEnabled ? [] : loadState('br_extras', []));
  const [expenses, setExpenses] = useState(() => firebaseEnabled ? [] : loadState('br_expenses', []));
  const [reservations, setReservations] = useState(() => firebaseEnabled ? [] : loadState('br_reservations', []));
  const [archives, setArchives] = useState(() => firebaseEnabled ? [] : loadState('br_archives', []));

  const todayDate = new Date().toISOString().split('T')[0];
  const [newCustData, setNewCustData] = useState({ name: '', phone: '', packageId: '', lineId: '', payStatus: 'Unpaid', payMethod: '', date: todayDate });
  const [newResData, setNewResData] = useState({ name: '', phone: '', packageId: '', payStatus: 'Unpaid', payMethod: '', date: todayDate });
  const [newLineData, setNewLineData] = useState({ name: '', phone: '', baseGB: '', carriedGB: '', invoice: '', extraRev: '' });
  const [newPkgData, setNewPkgData] = useState({ name: '', gb: '', mins: '', price: '' });
  const [newExtraData, setNewExtraData] = useState({ customerSearch: '', packageId: '', targetLineId: '', payStatus: 'Unpaid', payMethod: '', date: todayDate });
  const [newExpData, setNewExpData] = useState({ description: '', amount: '', lineId: '', date: todayDate });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const [resFilter, setResFilter] = useState('all');
  const [custFilter, setCustFilter] = useState('all');
  const [distributeMessage, setDistributeMessage] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [extraError, setExtraError] = useState('');
  const [extraFilter, setExtraFilter] = useState('all');

  const [editModal, setEditModal] = useState({ isOpen: false, type: '', data: null });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: '', id: null, title: '', message: '', onConfirm: null });

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!firebaseEnabled);
  const [isCloudLoaded, setIsCloudLoaded] = useState(false);
  const [loginEmail, setLoginEmail] = useState('ahmed.baheg555@gmail.com');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [activeCompany, setActiveCompany] = useState(() => firebaseEnabled ? 'we' : loadState('br_active_company', 'we'));
  const [companyStores, setCompanyStores] = useState(() => firebaseEnabled ? {} : loadState('br_company_stores', {}));
  // v1.7 additive operations layer. Existing business calculations remain untouched.
  const [activityLog, setActivityLog] = useState(() => firebaseEnabled ? [] : loadState('br_activity_log', []));
  const [trashBin, setTrashBin] = useState(() => firebaseEnabled ? [] : loadState('br_trash_bin', []));
  const [globalSearch, setGlobalSearch] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedLine, setSelectedLine] = useState(null);
  const [monthReviewOpen, setMonthReviewOpen] = useState(false);


  const snapshotCurrentCompany = () => ({
    customers, lines, packages, extraPackages, expenses, reservations, archives, activityLog, trashBin
  });

  const applyCompanyData = (data = {}) => {
    setCustomers(data.customers || []);
    setLines(data.lines || []);
    setPackages(data.packages || []);
    setExtraPackages(data.extraPackages || []);
    setExpenses(data.expenses || []);
    setReservations(data.reservations || []);
    setArchives(data.archives || []);
    setActivityLog(data.activityLog || []);
    setTrashBin(data.trashBin || []);
  };

  const resetBusinessState = () => {
    applyCompanyData(emptyCompanyData());
    setCompanyStores({});
    setActiveCompany('we');
    setCustFilter('all');
    setResFilter('all');
    setSearchQuery('');
    setGlobalSearch('');
    setSelectedCustomer(null);
    setSelectedLine(null);
    setIsCloudLoaded(false);
    setSyncStatus('');
  };

  const switchCompany = (companyId) => {
    if (companyId === activeCompany) return;
    const current = snapshotCurrentCompany();
    const target = companyStores[companyId] || emptyCompanyData();
    setCompanyStores(prev => ({ ...prev, [activeCompany]: current }));
    setActiveCompany(companyId);
    applyCompanyData(target);
    setCustFilter('all'); setResFilter('all'); setSearchQuery(''); setGlobalSearch('');
    setSelectedCustomer(null); setSelectedLine(null);
  };

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setAuthReady(true);
      setIsCloudLoaded(true);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // Always clear rendered business data before switching identity.
      // This prevents one account's in-memory/local data from flashing or being uploaded to another UID.
      resetBusinessState();
      setUser(currentUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!auth) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      setLoginPassword('');
    } catch (err) {
      console.error('Login error', err);
      setLoginError(isArabic ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Invalid email or password.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    resetBusinessState();
    if (auth) await signOut(auth);
  };

  const recordActivity = (action, details = '') => {
    const entry = { id: generateId('A'), action, details, at: new Date().toISOString() };
    setActivityLog(prev => [entry, ...prev].slice(0, 500));
  };

  useEffect(() => {
    if (!firebaseEnabled || !db || !user) return;
    let cancelled = false;
    const fetchCloudData = async () => {
       setIsCloudLoaded(false);
       setSyncStatus(isArabic ? 'جاري تحميل بيانات الحساب...' : 'Loading account data...');
       // Firestore is the source of truth. Never seed a new UID from another user's browser cache.
       resetBusinessState();
       try {
          const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'state');
          const docSnap = await getDoc(docRef);
          if (cancelled) return;
          if (docSnap.exists()) {
              const data = docSnap.data();
              const legacyWe = {
                customers: data.customers ? JSON.parse(data.customers) : [],
                lines: data.lines ? JSON.parse(data.lines) : [],
                packages: data.packages ? JSON.parse(data.packages) : [],
                extraPackages: data.extraPackages ? JSON.parse(data.extraPackages) : [],
                expenses: data.expenses ? JSON.parse(data.expenses) : [],
                reservations: data.reservations ? JSON.parse(data.reservations) : [],
                archives: data.archives ? JSON.parse(data.archives) : [],
                activityLog: data.activityLog ? JSON.parse(data.activityLog) : [],
                trashBin: data.trashBin ? JSON.parse(data.trashBin) : []
              };
              let cloudCompanies = {};
              try { cloudCompanies = data.companies ? JSON.parse(data.companies) : {}; } catch (_) { cloudCompanies = {}; }
              if (!cloudCompanies.we) cloudCompanies.we = legacyWe;
              COMPANY_OPTIONS.forEach(c => { if (!cloudCompanies[c.id]) cloudCompanies[c.id] = emptyCompanyData(); });
              const preferredCompany = loadUserState(user.uid, 'active_company', 'we');
              const safeCompany = COMPANY_OPTIONS.some(c => c.id === preferredCompany) ? preferredCompany : 'we';
              setCompanyStores(cloudCompanies);
              setActiveCompany(safeCompany);
              applyCompanyData(cloudCompanies[safeCompany]);
              setSyncStatus(isArabic ? 'متصل بالسحابة ✓' : 'Cloud connected ✓');
          } else {
              // Brand-new account: explicitly initialize it empty.
              const emptyCompanies = {};
              COMPANY_OPTIONS.forEach(c => { emptyCompanies[c.id] = emptyCompanyData(); });
              setCompanyStores(emptyCompanies);
              setActiveCompany('we');
              applyCompanyData(emptyCompanies.we);
              setSyncStatus(isArabic ? 'حساب جديد — لا توجد بيانات بعد' : 'New account — no data yet');
          }
       } catch(e) {
          console.error('Cloud fetch error', e);
          if (cancelled) return;
          // Offline/error fallback is scoped to the SAME UID only.
          const cachedCompanies = loadUserState(user.uid, 'company_stores', {});
          const cachedActive = loadUserState(user.uid, 'active_company', 'we');
          const safeCompany = COMPANY_OPTIONS.some(c => c.id === cachedActive) ? cachedActive : 'we';
          const normalized = { ...cachedCompanies };
          COMPANY_OPTIONS.forEach(c => { if (!normalized[c.id]) normalized[c.id] = emptyCompanyData(); });
          setCompanyStores(normalized);
          setActiveCompany(safeCompany);
          applyCompanyData(normalized[safeCompany] || emptyCompanyData());
          setSyncStatus(isArabic ? 'تعذر الاتصال — تم تحميل نسخة هذا الحساب فقط' : 'Offline — loaded this account cache only');
       }
       if (!cancelled) setIsCloudLoaded(true);
    };
    fetchCloudData();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!firebaseEnabled || !db || !user || !isCloudLoaded) return;
    const saveCloudData = async () => {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'state');
        const currentCompany = snapshotCurrentCompany();
        const allCompanies = { ...companyStores, [activeCompany]: currentCompany };
        const weData = allCompanies.we || emptyCompanyData();
        const dataToSave = {
          // Legacy fields remain WE for backwards compatibility with the original site/backup logic.
          customers: JSON.stringify(weData.customers || []),
          lines: JSON.stringify(weData.lines || []),
          packages: JSON.stringify(weData.packages || []),
          extraPackages: JSON.stringify(weData.extraPackages || []),
          expenses: JSON.stringify(weData.expenses || []),
          reservations: JSON.stringify(weData.reservations || []),
          archives: JSON.stringify(weData.archives || []),
          activityLog: JSON.stringify(weData.activityLog || []),
          trashBin: JSON.stringify(weData.trashBin || []),
          companies: JSON.stringify(allCompanies),
          timestamp: new Date().toISOString()
        };
        try {
          await setDoc(docRef, dataToSave);
          // Automatic daily snapshot: additive backup, does not replace the live state.
          const snapshotDay = new Date().toISOString().split('T')[0];
          const snapshotKey = `br_snapshot_${user.uid}`;
          if (localStorage.getItem(snapshotKey) !== snapshotDay) {
            const snapshotRef = doc(db, 'artifacts', appId, 'users', user.uid, 'snapshots', snapshotDay);
            await setDoc(snapshotRef, dataToSave);
            localStorage.setItem(snapshotKey, snapshotDay);
          }
          setSyncStatus(isArabic ? 'تمت المزامنة مع السحابة ✓' : 'Synced to cloud ✓');
        } catch(e) {
          console.error('Cloud save error', e);
          setSyncStatus(isArabic ? 'فشل الحفظ السحابي' : 'Cloud sync failed');
        }
    };
    const timeoutId = setTimeout(saveCloudData, 1500); 
    return () => clearTimeout(timeoutId);
  }, [customers, lines, packages, extraPackages, expenses, reservations, archives, activityLog, trashBin, companyStores, activeCompany, user, isCloudLoaded]);

  useEffect(() => localStorage.setItem('br_lang_ar', JSON.stringify(isArabic)), [isArabic]);
  useEffect(() => localStorage.setItem('br_theme_dark', JSON.stringify(isDarkMode)), [isDarkMode]);

  // v1.8.1 security migration: obsolete shared business-cache keys are no longer used with Firebase.
  useEffect(() => {
    if (!firebaseEnabled || !user) return;
    [
      'br_customers','br_lines','br_packages','br_extras','br_expenses','br_reservations',
      'br_archives','br_activity_log','br_trash_bin','br_active_company','br_company_stores'
    ].forEach(key => localStorage.removeItem(key));
  }, [user]);

  // Keep legacy local-only mode unchanged when Firebase is disabled.
  useEffect(() => {
    if (firebaseEnabled) return;
    localStorage.setItem('br_customers', JSON.stringify(customers));
    localStorage.setItem('br_lines', JSON.stringify(lines));
    localStorage.setItem('br_packages', JSON.stringify(packages));
    localStorage.setItem('br_extras', JSON.stringify(extraPackages));
    localStorage.setItem('br_expenses', JSON.stringify(expenses));
    localStorage.setItem('br_reservations', JSON.stringify(reservations));
    localStorage.setItem('br_archives', JSON.stringify(archives));
    localStorage.setItem('br_activity_log', JSON.stringify(activityLog));
    localStorage.setItem('br_trash_bin', JSON.stringify(trashBin));
    localStorage.setItem('br_active_company', JSON.stringify(activeCompany));
    localStorage.setItem('br_company_stores', JSON.stringify(companyStores));
  }, [customers, lines, packages, extraPackages, expenses, reservations, archives, activityLog, trashBin, activeCompany, companyStores]);

  // Authenticated browser cache is namespaced by Firebase UID.
  useEffect(() => {
    if (!firebaseEnabled || !user || !isCloudLoaded) return;
    const currentCompany = snapshotCurrentCompany();
    const allCompanies = { ...companyStores, [activeCompany]: currentCompany };
    saveUserState(user.uid, 'active_company', activeCompany);
    saveUserState(user.uid, 'company_stores', allCompanies);
  }, [customers, lines, packages, extraPackages, expenses, reservations, archives, activityLog, trashBin, activeCompany, companyStores, user, isCloudLoaded]);

  useEffect(() => {
    if (firebaseEnabled && (!user || !isCloudLoaded)) return;
    setCompanyStores(prev => ({ ...prev, [activeCompany]: snapshotCurrentCompany() }));
  }, [customers, lines, packages, extraPackages, expenses, reservations, archives, activityLog, trashBin, activeCompany, user, isCloudLoaded]);

  useEffect(() => {
      const seenIds = new Set();
      let needsHeal = false;
      const healed = customers.map(c => {
          if (seenIds.has(c.id)) {
              needsHeal = true;
              return { ...c, id: generateId('C') };
          }
          seenIds.add(c.id);
          return c;
      });
      if (needsHeal) setCustomers(healed);
  }, [customers]);

  const t = isArabic ? {
    menu: { home: '🏠 الرئيسية', dash: '📊 لوحة القيادة', cust: '👥 العملاء', lines: '📱 هيكلة الخطوط', extra: '🎁 الباقات الإضافية', pkg: '📦 الباقات', exp: '📉 المصروفات', res: '⏳ الحجوزات', search: '🔍 البحث', arch: '🗄️ الأرشيف', collect: '💳 التحصيل', reports: '📄 التقارير', activity: '🕘 سجل العمليات', trash: '♻️ سلة المحذوفات', backup: '💾 حفظ البيانات', lang: '🌐 English' },
    dash: { totCust: 'إجمالي العملاء', rev: 'إجمالي الإيرادات', exp: 'إجمالي المصروفات', profit: 'صافي الربح', availGb: 'إجمالي السعة (GB)', allocGb: 'الجيجات المستخدمة', remGb: 'الجيجات المتبقية', paidCust: 'عملاء دفعوا', unpCust: 'عملاء لم يدفعوا', insta: 'إنستاباي', vf: 'فودافون كاش', res: 'حجوزات', archMonth: '🔄 تقفيل الشهر' },
    common: { add: 'إضافة', edit: 'تعديل', del: 'حذف', save: 'حفظ', cancel: 'إلغاء', name: 'الاسم', phone: 'رقم الموبايل', date: 'التاريخ', amount: 'المبلغ', desc: 'الوصف', choose: '-- اختر --', actions: 'إجراءات', confirm: 'تأكيد' }
  } : {
    menu: { home: '🏠 Home', dash: '📊 Dashboard', cust: '👥 Customers', lines: '📱 Line Structure', extra: '🎁 Extras', pkg: '📦 Packages', exp: '📉 Expenses', res: '⏳ Reservations', search: '🔍 Search', arch: '🗄️ Archive', collect: '💳 Collections', reports: '📄 Reports', activity: '🕘 Activity Log', trash: '♻️ Recycle Bin', backup: '💾 Backup', lang: '🌐 العربية' },
    dash: { totCust: 'Total Customers', rev: 'Total Revenue', exp: 'Total Expenses', profit: 'Net Profit', availGb: 'Total Capacity', allocGb: 'Used GB', remGb: 'Remaining GB', paidCust: 'Paid Customers', unpCust: 'Unpaid Customers', insta: 'InstaPay', vf: 'Vodafone Cash', res: 'Reservations', archMonth: '🔄 Archive Month' },
    common: { add: 'Add', edit: 'Edit', del: 'Delete', save: 'Save', cancel: 'Cancel', name: 'Name', phone: 'Phone', date: 'Date', amount: 'Amount', desc: 'Description', choose: '-- Choose --', actions: 'Actions', confirm: 'Confirm' }
  };

  const inputClass = "br-input w-full px-4 py-3.5 bg-[#F8FAFC] border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 transition-all duration-200 text-sm font-semibold text-slate-800 placeholder-slate-400";
  const btnClass = "br-primary-btn w-full h-full bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 hover:brightness-110 text-white font-black py-3.5 px-5 rounded-xl shadow-[0_10px_28px_rgba(79,70,229,0.24)] transition-all duration-200 active:scale-[0.98] text-sm";
  const cardClass = "br-card bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.045)] hover:shadow-[0_14px_38px_rgba(15,23,42,0.07)] transition-all duration-300";

  const menuMeta = {
    home: { icon: '⌂', hint: 'مركز النظام' },
    dash: { icon: '◫', hint: 'الأرقام والمؤشرات' },
    cust: { icon: '◉', hint: 'إدارة المشتركين' },
    lines: { icon: '⌁', hint: 'السعات والتوزيع' },
    extra: { icon: '＋', hint: 'الإضافات والتحصيل' },
    pkg: { icon: '◇', hint: 'الخطط والأسعار' },
    exp: { icon: '−', hint: 'متابعة التكاليف' },
    res: { icon: '◷', hint: 'قائمة الانتظار' },
    search: { icon: '⌕', hint: 'وصول سريع' },
    arch: { icon: '▤', hint: 'السجل الشهري' },
    collect: { icon: '₤', hint: 'المبالغ غير المحصلة' },
    reports: { icon: '▧', hint: 'التقارير الشهرية' },
    activity: { icon: '◴', hint: 'سجل العمليات' },
    trash: { icon: '↺', hint: 'استرجاع المحذوفات' },
    backup: { icon: '↥', hint: 'النسخ والاستعادة' },
  };


  const getEffectiveLineId = (cust) => {
     const cExtras = extraPackages.filter(ex => ex.customerId === cust.id && ex.isActive !== false);
     const lastMoved = [...cExtras].reverse().find(ex => ex.targetLineId && ex.targetLineId !== cust.lineId);
     return lastMoved ? lastMoved.targetLineId : cust.lineId;
  };

  const getLineSlots = (lineId) => {
     return customers.filter(c => c.isActive !== false && getEffectiveLineId(c) === lineId).length;
  };

  const handleToggleBooking = (cust) => {
    const isCurrentlyBooked = cust.isConfirmed === true;
    const newIsBooked = !isCurrentlyBooked;

    // 1. تحديث حالة العميل في صفحة العملاء
    setCustomers(customers.map(c => c.id === cust.id ? { ...c, isConfirmed: newIsBooked } : c));

    // 2. المزامنة مع صفحة الحجوزات (إضافة أو إزالة)
    if (newIsBooked) {
        // تنظيف الرقم من المسافات قبل المقارنة لمنع التكرار
        const exists = reservations.some(r => (r.phone || '').trim() === (cust.phone || '').trim());
        if (!exists) {
            const newRes = {
                id: generateId('R'),
                name: cust.name,
                phone: cust.phone,
                packageId: cust.packageId,
                payStatus: 'Unpaid',
                payMethod: '',
                date: todayDate,
                isConfirmed: true,
                manualLineId: ''
            };
            setReservations(prev => [...prev, newRes]);
        }
    } else {
        setReservations(prev => prev.filter(r => r.phone !== cust.phone));
    }
  };

  const handleAddCust = (e) => {
    e.preventDefault();

    if (newCustData.lineId && getLineSlots(newCustData.lineId) >= 6) {
        setConfirmModal({
            isOpen: true, type: 'info', id: null,
            title: isArabic ? 'عذراً، الخط ممتلئ' : 'Line is Full',
            message: isArabic ? 'لا يمكن إضافة أكثر من 6 عملاء نشطين على نفس الخط.' : 'Cannot add more than 6 active customers to this line.',
            onConfirm: () => setConfirmModal({ isOpen: false, type: '', id: null })
        });
        return;
    }

    // تنظيف الرقم من المسافات قبل المقارنة لمنع التكرار
    const isDuplicate = customers.some(c => (c.phone || '').trim() === (newCustData.phone || '').trim());
    const processAdd = () => {
      setCustomers(prev => [...prev, { ...newCustData, phone: newCustData.phone.trim(), id: generateId('C'), isActive: true }]);
      recordActivity('إضافة عميل', `${newCustData.name} · ${newCustData.phone.trim()}`);
      setNewCustData({ name: '', phone: '', packageId: '', lineId: '', payStatus: 'Unpaid', payMethod: '', date: todayDate });
    };

    if (isDuplicate) {
      setConfirmModal({
        isOpen: true, type: 'duplicate_cust', id: null,
        title: isArabic ? 'تنبيه: عميل متكرر' : 'Duplicate Customer',
        message: isArabic ? 'يوجد عميل مسجل بهذا الرقم بالفعل. هل أنت متأكد من رغبتك في إضافته مرة أخرى؟' : 'Customer with this phone already exists. Add anyway?',
        onConfirm: () => {
          processAdd();
          setConfirmModal({ isOpen: false, type: '', id: null });
        }
      });
    } else {
      processAdd();
    }
  };

  const handleAddLine = (e) => {
    e.preventDefault();
    const newLine = { ...newLineData, id: generateId('L') };
    
    // استخراج الاسم الأساسي (مثال: 'Hader' من 'Hader-04')
    const baseName = newLine.name.split('-')[0].trim();
    
    // البحث عن آخر عنصر يحمل نفس الاسم الأساسي
    let insertIndex = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
       if (lines[i].name.split('-')[0].trim() === baseName) {
          insertIndex = i;
          break;
       }
    }
    
    // إدراج الخط الجديد في مكانه الصحيح
    let updatedLines = [...lines];
    if (insertIndex !== -1) {
       updatedLines.splice(insertIndex + 1, 0, newLine);
    } else {
       updatedLines.push(newLine);
    }
    
    setLines(updatedLines);
    recordActivity('إضافة خط', `${newLine.name} · ${newLine.phone}`);
    setNewLineData({ name: '', phone: '', baseGB: '', carriedGB: '', invoice: '', extraRev: '' });
  };

  const handleAddPkg = (e) => {
    e.preventDefault();
    setPackages([...packages, { ...newPkgData, id: generateId('P') }]);
    recordActivity('إضافة باقة', `${newPkgData.name} · ${newPkgData.price} EGP`);
    setNewPkgData({ name: '', gb: '', mins: '', price: '' });
  };

  const handleAddRes = (e) => {
    e.preventDefault();
    // تنظيف الرقم من المسافات قبل المقارنة لمنع التكرار
    const isDuplicate = reservations.some(r => (r.phone || '').trim() === (newResData.phone || '').trim()) || customers.some(c => (c.phone || '').trim() === (newResData.phone || '').trim());
    const processAdd = () => {
      setReservations(prev => [...prev, { ...newResData, phone: newResData.phone.trim(), id: generateId('R'), isConfirmed: true, manualLineId: '' }]);
      recordActivity('إضافة حجز', `${newResData.name} · ${newResData.phone.trim()}`);
      setNewResData({ name: '', phone: '', packageId: '', payStatus: 'Unpaid', payMethod: '', date: todayDate });
    };

    if (isDuplicate) {
      setConfirmModal({
        isOpen: true, type: 'duplicate_res', id: null,
        title: isArabic ? 'تنبيه: حجز متكرر' : 'Duplicate Reservation',
        message: isArabic ? 'هذا الرقم مسجل بالفعل في الحجوزات أو العملاء. هل تود إضافته كحجز جديد على أي حال؟' : 'Number already exists. Add as new reservation?',
        onConfirm: () => {
          processAdd();
          setConfirmModal({ isOpen: false, type: '', id: null });
        }
      });
    } else {
      processAdd();
    }
  };

  const handleAddExp = (e) => {
    e.preventDefault();
    setExpenses([...expenses, { ...newExpData, id: generateId('E') }]);
    recordActivity('إضافة مصروف', `${newExpData.description} · ${newExpData.amount} EGP`);
    setNewExpData({ description: '', amount: '', lineId: '', date: todayDate });
  };

  const handleAddExtra = (e) => {
    e.preventDefault();
    const cust = customers.find(c => c.phone.includes(newExtraData.customerSearch) || c.id.includes(newExtraData.customerSearch));
    if (!cust) { setExtraError(isArabic ? 'العميل غير موجود!' : 'Customer not found!'); return; }
    
    const targetLine = newExtraData.targetLineId || cust.lineId;

    if (targetLine !== cust.lineId && getLineSlots(targetLine) >= 6) {
        setConfirmModal({
            isOpen: true, type: 'info', id: null,
            title: isArabic ? 'عذراً، الخط ممتلئ' : 'Line is Full',
            message: isArabic ? 'لا يمكن نقل الباقة الإضافية لخط يحتوي على 6 أفراد.' : 'Cannot transfer extra package to a line with 6 customers.',
            onConfirm: () => setConfirmModal({ isOpen: false, type: '', id: null })
        });
        return;
    }

    const processAdd = () => {
      const newExtra = {
        id: generateId('EX'), customerId: cust.id, lineId: cust.lineId, targetLineId: targetLine,
        packageId: newExtraData.packageId, payStatus: newExtraData.payStatus, 
        payMethod: newExtraData.payStatus === 'Paid' ? newExtraData.payMethod : '', date: newExtraData.date, isActive: true
      };
      
      setExtraPackages(prev => [...prev, newExtra]);
      recordActivity('إضافة باقة إضافية', `${cust.name} · ${packages.find(p=>p.id===newExtra.packageId)?.name || ''}`);
      
      setNewExtraData({ customerSearch: '', packageId: '', targetLineId: '', payStatus: 'Unpaid', payMethod: '', date: todayDate });
      setExtraError('');
    };

    const isDuplicate = extraPackages.some(ex => ex.customerId === cust.id);
    if (isDuplicate) {
      setConfirmModal({
        isOpen: true, type: 'duplicate_extra', id: null,
        title: isArabic ? 'تنبيه: باقة إضافية متكررة' : 'Duplicate Extra Package',
        message: isArabic ? 'هذا العميل لديه باقة إضافية مسجلة بالفعل. هل تريد إضافة باقة أخرى له؟' : 'Customer already has an extra package. Add another?',
        onConfirm: () => {
          processAdd();
          setConfirmModal({ isOpen: false, type: '', id: null });
        }
      });
    } else {
      processAdd();
    }
  };

  // Historical placement helpers are additive only: they let the new distribution
  // prefer last month's line without changing the existing fallback allocation rules.
  const getArchivedCustomerPlacement = (customerOrReservation) => {
    const phone = (customerOrReservation?.phone || '').trim();
    const id = customerOrReservation?.id || '';
    for (let i = archives.length - 1; i >= 0; i--) {
      const arc = archives[i];
      const snapshot = Array.isArray(arc?.customersSnapshot) ? arc.customersSnapshot : [];
      const archivedCustomer = snapshot.find(c =>
        (phone && (c.phone || '').trim() === phone) || (id && c.id === id)
      );
      if (archivedCustomer) {
        const lineSnapshot = Array.isArray(arc?.linesSnapshot) ? arc.linesSnapshot : [];
        const archivedLine = lineSnapshot.find(l => l.id === archivedCustomer.lineId);
        return {
          customer: archivedCustomer,
          lineId: archivedCustomer.lineId,
          line: archivedLine || null,
          archive: arc
        };
      }
    }
    return null;
  };

  const buildBalanceSuggestions = () => {
    const metrics = lines.map(line => {
      const activeCustomers = customers.filter(c => c.isActive !== false && c.lineId === line.id);
      const baseUsed = activeCustomers.reduce((sum, c) => sum + (Number(packages.find(p => p.id === c.packageId)?.gb) || 0), 0);
      const extraUsed = extraPackages
        .filter(ex => (ex.targetLineId || ex.lineId) === line.id && ex.isActive !== false)
        .reduce((sum, ex) => sum + (Number(packages.find(p => p.id === ex.packageId)?.gb) || 0), 0);
      const avail = Number(line.baseGB || 0) + Number(line.carriedGB || 0);
      const used = baseUsed + extraUsed;
      return { line, activeCustomers, avail, used, count: activeCustomers.length, utilization: avail ? used / avail : 0 };
    });

    const suggestions = [];
    const sources = [...metrics].sort((a,b)=>b.utilization-a.utilization);
    const targets = [...metrics].sort((a,b)=>a.utilization-b.utilization);

    for (const source of sources) {
      if (source.utilization < 0.78 || source.activeCustomers.length === 0) continue;
      let best = null;
      for (const target of targets) {
        if (target.line.id === source.line.id || target.count >= 6 || target.avail <= 0) continue;
        for (const cust of source.activeCustomers) {
          const gb = Number(packages.find(p => p.id === cust.packageId)?.gb) || 0;
          if (!gb || target.used + gb > target.avail) continue;
          const beforeGap = Math.abs(source.utilization - target.utilization);
          const afterSource = Math.max(0, (source.used - gb) / (source.avail || 1));
          const afterTarget = (target.used + gb) / (target.avail || 1);
          const afterGap = Math.abs(afterSource - afterTarget);
          const improvement = beforeGap - afterGap;
          if (improvement <= 0.08) continue;
          if (!best || improvement > best.improvement) {
            best = { source, target, cust, gb, improvement, afterSource, afterTarget };
          }
        }
      }
      if (best && !suggestions.some(x => x.cust.id === best.cust.id)) suggestions.push(best);
      if (suggestions.length >= 4) break;
    }
    return suggestions;
  };

  const handleDistributeReservations = () => {
    let newCustomers = [...customers];
    let movedCount = 0;
    let distributedResIds = [];

    // جمع إحصائيات الخطوط بالكامل وتضمين أنواع الباقات للتحقق من التنوع
    let lineStats = lines.map(l => {
        let count = newCustomers.filter(c => getEffectiveLineId(c) === l.id && c.isActive !== false).length;
        let used = newCustomers.filter(c => c.lineId === l.id && c.isActive !== false).reduce((sum, c) => sum + (Number(packages.find(p => p.id === c.packageId)?.gb) || 0), 0);
        used += extraPackages.filter(ex => (ex.targetLineId || ex.lineId) === l.id && ex.isActive !== false).reduce((sum, ex) => sum + (Number(packages.find(p => p.id === ex.packageId)?.gb) || 0), 0);
        
        let packageTypes = newCustomers.filter(c => c.lineId === l.id && c.isActive !== false).map(c => c.packageId);
        extraPackages.filter(ex => (ex.targetLineId || ex.lineId) === l.id && ex.isActive !== false).forEach(ex => packageTypes.push(ex.packageId));
        
        return { id: l.id, baseGB: Number(l.baseGB || 0), count, used, avail: Number(l.baseGB || 0) + Number(l.carriedGB || 0), packageTypes };
    });

    // الترتيب: الباقات الصغيرة أولاً (<=20) ثم الكبيرة (>25) ثم (25)
    let sortedReservations = [...reservations].sort((a, b) => {
        let gbA = Number(packages.find(p => p.id === a.packageId)?.gb) || 0;
        let gbB = Number(packages.find(p => p.id === b.packageId)?.gb) || 0;
        
        const getGroup = (gb) => {
            if (gb <= 20) return 1; 
            if (gb > 25) return 2;  
            return 3;               
        };
        
        let grpA = getGroup(gbA);
        let grpB = getGroup(gbB);
        
        if (grpA !== grpB) return grpA - grpB;
        return gbB - gbA; 
    });

    sortedReservations.forEach(res => {
        if (res.isDistributed) return; 
        if (res.isConfirmed === false) return; // حماية إضافية لتجاهل غير الحاجزين بشكل صارم

        let pkgGb = Number(packages.find(p => p.id === res.packageId)?.gb) || 0;
        let assignedLineId = null;

        // مطابقة الرقم بدقة وتجاهل المسافات الزائدة لمنع التكرار
        let existingCustIndex = newCustomers.findIndex(c => (c.phone || '').trim() === (res.phone || '').trim());
        let preferredLineId = null;

        // أولوية الاستمرارية: نفس خط العميل السابق أولاً، حتى لو غيّر الباقة،
        // بشرط أن السعة والعدد يسمحان. لو العميل غير موجود حالياً نرجع لآخر شهر مؤرشف.
        if (existingCustIndex !== -1) {
            let c = newCustomers[existingCustIndex];
            let oldPkgGb = Number(packages.find(p => p.id === c.packageId)?.gb) || 0;
            let oldLineStat = lineStats.find(l => l.id === getEffectiveLineId(c)); 
            let oldBaseLineStat = lineStats.find(l => l.id === c.lineId); 
            
            if (oldLineStat) oldLineStat.count -= 1;
            if (oldBaseLineStat) oldBaseLineStat.used -= oldPkgGb;
            preferredLineId = getEffectiveLineId(c);
        } else {
            const archivedPlacement = getArchivedCustomerPlacement(res);
            if (archivedPlacement?.lineId) preferredLineId = archivedPlacement.lineId;
        }

        if (res.manualLineId) {
            let mLine = lineStats.find(l => l.id === res.manualLineId);
            // تطبيق قاعدة الـ 6 أفراد الصارمة حتى في التوزيع اليدوي
            if (mLine && mLine.count < 6) {
                assignedLineId = res.manualLineId;
            }
        }

        // تشغيل التوزيع التلقائي فقط إذا لم يتم تحديد خط يدوي أو كان الخط اليدوي ممتلئاً
        if (!assignedLineId) {
            // Priority 1: استبعاد أي خط به 6 أفراد أو يتجاوز الحد + 5 جيجا بافر
            let candidates = lineStats.filter(l => l.count < 6 && (l.used + pkgGb <= l.avail + 5));

            // Priority 3: منع وضع باقة واحدة فقط في الخطوط الكبيرة عند اكتمال الخط
        if (preferredLineId && candidates.some(l => l.id === preferredLineId)) {
            assignedLineId = preferredLineId; // أولوية للخط السابق إذا كان لا يكسر القواعد
        } else if (candidates.length > 0) {
            
            // نظام النقاط وتطبيق أولويات التوزيع الصارمة
            candidates.forEach(l => {
                let score = 0;
                let isSmallLine = l.avail < 200;
                let isLargeLine = l.avail >= 200;

                // Priority 6: منع استخدام الـ Buffer إلا عند الضرورة القصوى جداً
                let willUseBuffer = (l.used + pkgGb > l.avail);
                if (willUseBuffer) score += 50000; 

                // Priority 4: الباقات الصغيرة (<=20) للخطوط الصغيرة أولاً
                if (pkgGb <= 20) {
                    if (isSmallLine) score -= 10000;
                    else score += 5000;
                }

                // Priority 4: الباقات الكبيرة (>25) تذهب للخطوط الكبيرة
                if (pkgGb > 25) {
                    if (isLargeLine) score -= 10000;
                    else score += 5000;
                }

                // Priority 4: باقات 25 للخطوط الصغيرة إذا توفرت مساحة
                if (pkgGb === 25) {
                    if (isSmallLine) score -= 5000;
                }

                // Priority 3: تنويع الباقات في الخطوط
                let uniquePkgTypes = new Set(l.packageTypes);
                if (uniquePkgTypes.size === 1 && uniquePkgTypes.has(res.packageId)) {
                    score += isLargeLine ? 3000 : 1000; 
                } else if (uniquePkgTypes.size > 0 && !uniquePkgTypes.has(res.packageId)) {
                    score -= isLargeLine ? 3000 : 1000; 
                }

                // Priority 5: التوزيع بالتساوي وتقارب الجيجات بين الخطوط
                score += (l.count * 100); 
                let utilization = (l.used + pkgGb) / (l.avail || 1);
                score += utilization * 50;

                l._currentScore = score;
            });
                candidates.sort((a, b) => a._currentScore - b._currentScore);
                assignedLineId = candidates[0].id;
            }
        } // إغلاق شرط التوزيع التلقائي
        
        if (assignedLineId) {
            let lineForCount = lineStats.find(l => l.id === assignedLineId);
            let lineForGb = lineStats.find(l => l.id === assignedLineId);
            if (lineForCount) {
                lineForCount.count += 1; 
                lineForCount.packageTypes.push(res.packageId); 
            }
            if (lineForGb) lineForGb.used += pkgGb;
            
            if (existingCustIndex !== -1) {
                newCustomers[existingCustIndex] = { 
                    ...newCustomers[existingCustIndex], 
                    packageId: res.packageId, 
                    lineId: assignedLineId, 
                    payStatus: res.payStatus, 
                    payMethod: res.payMethod, 
                    date: res.date, 
                    isActive: true,
                    isConfirmed: true 
                };
            } else {
                // حفظ الرقم بدون مسافات زائدة
                newCustomers.push({ id: generateId('C'), name: res.name, phone: (res.phone || '').trim(), packageId: res.packageId, lineId: assignedLineId, payStatus: res.payStatus, payMethod: res.payMethod, date: res.date, isActive: true, isConfirmed: true });
            }
            movedCount++;
            distributedResIds.push(res.id);
        } else if (existingCustIndex !== -1) {
            let c = newCustomers[existingCustIndex];
            let oldPkgGb = Number(packages.find(p => p.id === c.packageId)?.gb) || 0;
            let oldLineStat = lineStats.find(l => l.id === getEffectiveLineId(c));
            let oldBaseLineStat = lineStats.find(l => l.id === c.lineId);
            if (oldLineStat) oldLineStat.count += 1;
            if (oldBaseLineStat) oldBaseLineStat.used += oldPkgGb;
        }
    });

    setCustomers(newCustomers);
    setReservations(reservations.map(r => distributedResIds.includes(r.id) ? { ...r, isDistributed: true } : r));
    recordActivity('توزيع الحجوزات', `تم توزيع ${movedCount} عميل`);
    setDistributeMessage(isArabic ? `تم تفعيل وتوزيع ${movedCount} عميل بنجاح!` : `Distributed ${movedCount} customers!`);
    setTimeout(() => setDistributeMessage(''), 5000);
  };

  const handleArchiveReservations = () => {
    setConfirmModal({
       isOpen: true, type: 'clear_reservations',
       title: isArabic ? 'تقفيل الحجوزات' : 'Archive Reservations',
       message: isArabic ? 'هل أنت متأكد من مسح جميع الحجوزات استعداداً للشهر الجديد؟ (الحجوزات التي تم تفعيلها أصبحت عملاء ولن تمس).' : 'Clear all reservations for the new month?',
       onConfirm: () => {
         setReservations([]);
         setConfirmModal({ isOpen: false, type: '', id: null });
       }
    });
  };

  const handleDelete = (type, id) => {
    setConfirmModal({
       isOpen: true, type, id,
       title: isArabic ? 'تأكيد الحذف' : 'Confirm Deletion',
       message: isArabic ? 'هل أنت متأكد من حذف هذا العنصر؟ سيتم الاحتفاظ بنسخة في سلة المحذوفات للاسترجاع.' : 'Delete this item? A recovery copy will be kept in the recycle bin.',
       onConfirm: () => {
         const source = type === 'customer' ? customers : type === 'line' ? lines : type === 'package' ? packages : type === 'extra' ? extraPackages : type === 'expense' ? expenses : type === 'reservation' ? reservations : [];
         const deletedItem = source.find(item => item.id === id);
         if (deletedItem) setTrashBin(prev => [{ id: generateId('T'), type, item: deletedItem, deletedAt: new Date().toISOString() }, ...prev].slice(0, 200));
         if (type === 'customer') setCustomers(customers.filter(c => c.id !== id));
         if (type === 'line') setLines(lines.filter(l => l.id !== id));
         if (type === 'package') setPackages(packages.filter(p => p.id !== id));
         if (type === 'extra') setExtraPackages(extraPackages.filter(e => e.id !== id));
         if (type === 'expense') setExpenses(expenses.filter(e => e.id !== id));
         if (type === 'reservation') setReservations(reservations.filter(r => r.id !== id));
         recordActivity('حذف عنصر', `${type} · ${id}`);
         setConfirmModal({ isOpen: false, type: '', id: null });
       }
    });
  };

  const restoreTrashItem = (trashId) => {
    const entry = trashBin.find(t => t.id === trashId);
    if (!entry) return;
    const item = entry.item;
    if (entry.type === 'customer') setCustomers(prev => [...prev, item]);
    if (entry.type === 'line') setLines(prev => [...prev, item]);
    if (entry.type === 'package') setPackages(prev => [...prev, item]);
    if (entry.type === 'extra') setExtraPackages(prev => [...prev, item]);
    if (entry.type === 'expense') setExpenses(prev => [...prev, item]);
    if (entry.type === 'reservation') setReservations(prev => [...prev, item]);
    setTrashBin(prev => prev.filter(t => t.id !== trashId));
    recordActivity('استرجاع من سلة المحذوفات', `${entry.type} · ${item.id || ''}`);
  };

  const handleSaveEdit = () => {
    const { type, data } = editModal;
    if (type === 'customer') {
        const oldData = customers.find(c => c.id === data.id);
        if (oldData && oldData.lineId !== data.lineId && data.isActive !== false && getLineSlots(data.lineId) >= 6) {
            setConfirmModal({
                isOpen: true, type: 'info', title: isArabic ? 'عذراً، الخط ممتلئ' : 'Line is Full',
                message: isArabic ? 'لا يمكن نقل العميل لخط يحتوي على 6 أفراد.' : 'Cannot move customer to a full line.',
                onConfirm: () => setConfirmModal({ isOpen: false, type: '', id: null })
            });
            return;
        }
        setCustomers(customers.map(c => c.id === data.id ? data : c));
    }
    else if (type === 'line') setLines(lines.map(l => l.id === data.id ? data : l));
    else if (type === 'package') setPackages(packages.map(p => p.id === data.id ? data : p));
    else if (type === 'extra') {
        const oldData = extraPackages.find(e => e.id === data.id);
        if (oldData && oldData.targetLineId !== data.targetLineId && data.targetLineId !== data.lineId && getLineSlots(data.targetLineId) >= 6) {
            setConfirmModal({
                isOpen: true, type: 'info', title: isArabic ? 'عذراً، الخط ممتلئ' : 'Line is Full',
                message: isArabic ? 'لا يمكن نقل الباقة لخط يحتوي على 6 أفراد.' : 'Cannot move extra package to a full line.',
                onConfirm: () => setConfirmModal({ isOpen: false, type: '', id: null })
            });
            return;
        }
        setExtraPackages(extraPackages.map(e => e.id === data.id ? data : e));
    }
    else if (type === 'expense') setExpenses(expenses.map(e => e.id === data.id ? data : e));
    else if (type === 'reservation') setReservations(reservations.map(r => r.id === data.id ? data : r));
    recordActivity('تعديل بيانات', `${type} · ${data.id || ''}`);
    setEditModal({ isOpen: false, type: '', data: null });
  };

  let totalRev = 0;
  let expectedRev = 0;
  let instaPayCount = 0; let instaPaySum = 0;
  let vfCashCount = 0; let vfCashSum = 0;
  
  const processPayment = (status, method, price) => {
    expectedRev += price;
    if (status === 'Paid' || status === 'مدفوع' || status === 'Paid ') {
      totalRev += price;
      if (method === 'InstaPay') { instaPayCount++; instaPaySum += price; }
      else if (method === 'Vodafone Cash') { vfCashCount++; vfCashSum += price; }
    }
  };

  customers.forEach(c => processPayment(c.payStatus, c.payMethod, Number(packages.find(p => p.id === c.packageId)?.price || 0)));
  extraPackages.forEach(ex => processPayment(ex.payStatus, ex.payMethod, Number(packages.find(p => p.id === ex.packageId)?.price || 0)));
  lines.forEach(l => {
     totalRev += Number(l.extraRev || 0);
     expectedRev += Number(l.extraRev || 0);
  });

  let totalExp = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0) + lines.reduce((sum, l) => sum + Number(l.invoice || 0), 0);
  
  let netProfit = totalRev - totalExp;
  let expectedProfit = expectedRev - totalExp;

  let totalAvailGB = lines.reduce((sum, l) => sum + Number(l.baseGB || 0) + Number(l.carriedGB || 0), 0);
  let totalAllocGB = customers.reduce((sum, c) => sum + Number(packages.find(p => p.id === c.packageId)?.gb || 0), 0) 
                   + extraPackages.reduce((sum, ex) => sum + Number(packages.find(p => p.id === ex.packageId)?.gb || 0), 0);
  let totalRemainingGB = totalAvailGB - totalAllocGB;

  let paidCustCount = customers.filter(c => c.payStatus === 'Paid' || c.payStatus === 'مدفوع').length;
  let unpCustCount = customers.filter(c => c.payStatus !== 'Paid' && c.payStatus !== 'مدفوع').length;

  let totalCustomersCount = customers.length;
  let totalExtraPackagesCount = extraPackages.length;
  let totalExtraGB = extraPackages.reduce((sum, ex) => sum + (Number(packages.find(p => p.id === ex.packageId)?.gb) || 0), 0);
  let totalExtraPackagesValue = extraPackages.reduce((sum, ex) => sum + (Number(packages.find(p => p.id === ex.packageId)?.price) || 0), 0);

  // Additive operational insights. Existing revenue/payment formulas above are intentionally untouched.
  const unpaidCustomers = customers.filter(c => c.payStatus !== 'Paid' && c.payStatus !== 'مدفوع');
  const unpaidBaseAmount = unpaidCustomers.reduce((sum,c) => sum + Number(packages.find(p=>p.id===c.packageId)?.price || 0), 0);
  const unpaidExtrasAmount = extraPackages.filter(ex => ex.payStatus !== 'Paid' && ex.payStatus !== 'مدفوع').reduce((sum,ex)=>sum+Number(packages.find(p=>p.id===ex.packageId)?.price || 0),0);
  const amountDue = unpaidBaseAmount + unpaidExtrasAmount;
  const nearFullLines = lines.filter(l => getLineSlots(l.id) >= 5);
  const topPackage = packages.map(p => ({...p, count: customers.filter(c=>c.packageId===p.id).length})).sort((a,b)=>b.count-a.count)[0];
  const pressureLine = lines.map(l => ({...l, slots:getLineSlots(l.id)})).sort((a,b)=>b.slots-a.slots)[0];
  const lastArchive = archives.length ? archives[archives.length-1] : null;
  const revenueDelta = lastArchive?.stats?.totalRev ? ((totalRev - Number(lastArchive.stats.totalRev)) / Math.max(1, Number(lastArchive.stats.totalRev))) * 100 : null;
  const notifications = [
    unpaidCustomers.length > 0 && { tone:'danger', title:`${unpaidCustomers.length} عميل غير مدفوع`, text:`إجمالي مطلوب تحصيله: ${unpaidBaseAmount.toLocaleString()} EGP`, action:'unpaid' },
    reservations.filter(r=>!r.isDistributed).length > 0 && { tone:'warning', title:`${reservations.filter(r=>!r.isDistributed).length} حجز في الانتظار`, text:'توجد حجوزات لم يتم توزيعها بعد.', action:'res' },
    nearFullLines.length > 0 && { tone:'brand', title:`${nearFullLines.length} خط قريب من الامتلاء`, text:'خطوط تحتوي على 5 أو 6 عملاء نشطين.', action:'lines' },
    totalRemainingGB < 50 && { tone:'danger', title:'السعة المتبقية منخفضة', text:`المتبقي ${totalRemainingGB.toLocaleString()} GB فقط.`, action:'lines' }
  ].filter(Boolean);
  const globalResults = globalSearch.trim() ? [
    ...customers.filter(c => `${c.name} ${c.phone} ${c.id}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0,5).map(c=>({kind:'customer',id:c.id,title:c.name,sub:c.phone,data:c})),
    ...lines.filter(l => `${l.name} ${l.phone} ${l.id}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0,4).map(l=>({kind:'line',id:l.id,title:l.name,sub:l.phone,data:l})),
    ...packages.filter(p => `${p.name} ${p.id}`.toLowerCase().includes(globalSearch.toLowerCase())).slice(0,3).map(p=>({kind:'package',id:p.id,title:p.name,sub:`${p.gb} GB · ${p.price} EGP`,data:p}))
  ].slice(0,10) : [];

  const openUnpaidCustomers = () => { setCustFilter('unpaid'); setActiveTab('cust'); setNotificationsOpen(false); };
  const exportMonthlyReportCsv = () => {
    const BOM='\uFEFF';
    const rows=[['المؤشر','القيمة'],['الإيرادات المحصلة',totalRev],['الإيرادات المتوقعة',expectedRev],['المصروفات والفواتير',totalExp],['صافي الربح',netProfit],['العملاء',customers.length],['العملاء غير المدفوعين',unpaidCustomers.length],['المطلوب تحصيله',amountDue],['الباقات الإضافية',totalExtraPackagesValue],['InstaPay',instaPaySum],['Vodafone Cash',vfCashSum]];
    const content=BOM+rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    const blob=new Blob([content],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`BR_Telecom_Monthly_Report_${todayDate}.csv`; a.click(); URL.revokeObjectURL(url);
    recordActivity('تصدير تقرير شهري','CSV');
  };

  const handleArchiveMonth = () => setMonthReviewOpen(true);

  const confirmArchiveMonth = () => {
    setMonthReviewOpen(false);
    setConfirmModal({
       isOpen: true, title: t.dash.archMonth,
       message: isArabic ? 'سيتم حفظ الإحصائيات للأرشيف، وتحويل العملاء لغير مدفوعين، وتصفير الباقات الإضافية والمصروفات. (الحجوزات لن تتأثر)' : 'Archive stats, set customers unpaid, clear extras/expenses?',
       onConfirm: () => {
         setMonthReviewOpen(false);
         recordActivity('تقفيل الشهر', `إيرادات ${totalRev} · مصروفات ${totalExp} · صافي ${netProfit}`);
         const archiveData = {
           date: new Date().toISOString(),
           stats: { totalRev, totalExp, netProfit },
           // Detailed snapshot powers historical search and next-month continuity.
           // Existing archive statistics and month-closing behavior remain unchanged.
           customersSnapshot: JSON.parse(JSON.stringify(customers)),
           linesSnapshot: JSON.parse(JSON.stringify(lines)),
           packagesSnapshot: JSON.parse(JSON.stringify(packages)),
           extraPackagesSnapshot: JSON.parse(JSON.stringify(extraPackages))
         };
         setArchives([...archives, archiveData]);
         setCustomers(customers.map(c => ({ ...c, payStatus: 'Unpaid', payMethod: '', isConfirmed: false })));
         setExtraPackages([]); setExpenses([]);
         setConfirmModal({ isOpen: false });
       }
    });
  };

  const restoreLatestCloudSnapshot = async () => {
    if (!db || !user) return;
    try {
      const snapshotsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'snapshots');
      const snapQuery = query(snapshotsRef, orderBy(documentId(), 'desc'), limit(1));
      const result = await getDocs(snapQuery);
      if (result.empty) {
        setConfirmModal({isOpen:true,type:'info',title:'لا توجد نسخة سحابية',message:'لم يتم إنشاء Snapshot تلقائي بعد.',onConfirm:()=>setConfirmModal({isOpen:false,type:'',id:null})});
        return;
      }
      const snapDoc = result.docs[0];
      const data = snapDoc.data();
      setConfirmModal({
        isOpen:true,type:'restore_cloud',title:'استرجاع آخر Snapshot سحابي',
        message:`سيتم استرجاع نسخة ${snapDoc.id}. سيتم استبدال الحالة الحالية بنفس بيانات هذه النسخة. هل تريد المتابعة؟`,
        onConfirm:()=>{
          if (data.companies) {
            try {
              const restoredCompanies = JSON.parse(data.companies);
              setCompanyStores(restoredCompanies);
              applyCompanyData(restoredCompanies[activeCompany] || restoredCompanies.we || emptyCompanyData());
            } catch (_) {}
          } else {
          if (data.customers) setCustomers(JSON.parse(data.customers));
          if (data.lines) setLines(JSON.parse(data.lines));
          if (data.packages) setPackages(JSON.parse(data.packages));
          if (data.extraPackages) setExtraPackages(JSON.parse(data.extraPackages));
          if (data.expenses) setExpenses(JSON.parse(data.expenses));
          if (data.reservations) setReservations(JSON.parse(data.reservations));
          if (data.archives) setArchives(JSON.parse(data.archives));
          if (data.activityLog) setActivityLog(JSON.parse(data.activityLog));
          if (data.trashBin) setTrashBin(JSON.parse(data.trashBin));
          }
          recordActivity('استرجاع Snapshot سحابي', snapDoc.id);
          setConfirmModal({isOpen:false,type:'',id:null});
        }
      });
    } catch (e) {
      console.error('Snapshot restore error', e);
      setConfirmModal({isOpen:true,type:'info',title:'تعذر الاسترجاع',message:'حدث خطأ أثناء قراءة النسخ السحابية.',onConfirm:()=>setConfirmModal({isOpen:false,type:'',id:null})});
    }
  };

  const handleExportData = () => {
    const data = { company: activeCompany, customers, lines, packages, extraPackages, expenses, reservations, archives, activityLog, trashBin };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BR_Telecom_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.customers) setCustomers(data.customers);
        if (data.lines) setLines(data.lines);
        if (data.packages) setPackages(data.packages);
        if (data.extraPackages) setExtraPackages(data.extraPackages);
        if (data.expenses) setExpenses(data.expenses);
        if (data.reservations) setReservations(data.reservations);
        if (data.archives) setArchives(data.archives);
        if (data.activityLog) setActivityLog(data.activityLog);
        if (data.trashBin) setTrashBin(data.trashBin);
        
        const counts = {
          customers: data.customers?.length || 0,
          lines: data.lines?.length || 0,
          packages: data.packages?.length || 0,
          extras: data.extraPackages?.length || 0,
          expenses: data.expenses?.length || 0,
          reservations: data.reservations?.length || 0,
          archives: data.archives?.length || 0,
        };
        setSyncStatus(isArabic ? 'جاري رفع النسخة المستردة إلى السحابة...' : 'Uploading restored backup to cloud...');
        setConfirmModal({
            isOpen: true, type: 'info',
            title: isArabic ? 'تم استرجاع النسخة' : 'Backup restored',
            message: isArabic
              ? `تم استرجاع ${counts.customers} عميل، ${counts.lines} خط، ${counts.packages} باقة، ${counts.extras} باقة إضافية، ${counts.expenses} مصروف، ${counts.reservations} حجز و${counts.archives} سجل أرشيف. ستتم المزامنة مع Firebase تلقائياً.`
              : `Restored ${counts.customers} customers, ${counts.lines} lines, ${counts.packages} packages, ${counts.extras} extras, ${counts.expenses} expenses, ${counts.reservations} reservations and ${counts.archives} archives. Firebase sync will run automatically.`,
            onConfirm: () => setConfirmModal({ isOpen: false, type: '', id: null })
        });
      } catch (err) {
        setConfirmModal({
            isOpen: true, type: 'info',
            title: isArabic ? 'خطأ' : 'Error',
            message: isArabic ? 'الملف غير صالح أو تالف.' : 'Invalid or corrupted file.',
            onConfirm: () => setConfirmModal({ isOpen: false, type: '', id: null })
        });
      }
    };
    reader.readAsText(file);
    e.target.value = null; // reset input
  };

  const handleExportCustomers = () => {
    // إضافة BOM لدعم اللغة العربية في إكسيل
    const BOM = '\uFEFF';
    const headers = ['الاسم', 'رقم الموبايل', 'الباقة', 'الخط الأساسي', 'حالة الدفع', 'طريقة الدفع', 'حالة التفعيل'].map(h => `"${h}"`).join(',');
    
    const rows = customers.map(c => {
      const pkgName = packages.find(p => p.id === c.packageId)?.name || 'غير محدد';
      const line = lines.find(l => l.id === c.lineId);
      const lineDetails = line ? `${line.phone} (${line.name})` : 'غير محدد';
      const isBooked = c.isConfirmed === true ? 'حاجز' : 'لم يحجز';
      
      return [c.name, c.phone, pkgName, lineDetails, c.payStatus, c.payMethod || 'لا يوجد', isBooked]
        .map(val => `"${val}"`).join(',');
    });

    const csvContent = BOM + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Customers_List_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12 ? 'صباح الخير' : 'مساء الخير';

  const renderHome = () => (
    <div className="v16-page animate-fade-in">
      <section className="v17-command-hero">
        <div>
          <span className="v16-live"><i></i> النظام متصل بالسحابة</span>
          <p className="v16-eyebrow">BR Telecom Command Center</p>
          <h1>{timeGreeting} 👋</h1>
          <p>ملخص يومك في مكان واحد، مع اختصارات مباشرة للحاجات اللي محتاجة متابعة.</p>
        </div>
        <div className="v17-command-date"><span>{new Date().toLocaleDateString('ar-EG',{weekday:'long'})}</span><strong>{new Date().toLocaleDateString('ar-EG',{day:'numeric',month:'long'})}</strong></div>
      </section>
      <Surface className="v18-company-center">
        <div className="v18-company-head"><div><span>شركات الاتصالات</span><h3>اختر الشركة لإدارة بياناتها بشكل مستقل</h3></div><Status tone="brand">{COMPANY_OPTIONS.find(c=>c.id===activeCompany)?.name}</Status></div>
        <div className="v18-company-grid">{COMPANY_OPTIONS.map(company=><button key={company.id} type="button" className={`v18-company-card ${company.tone} ${activeCompany===company.id?'active':''}`} onClick={()=>switchCompany(company.id)}><i></i><div><strong>{company.name}</strong><span>{company.id==='we'?'البيانات الحالية':'مساحة مستقلة'}</span></div><b>←</b></button>)}</div>
      </Surface>
      <div className="v19-command-grid">
        <button className="v17-command-card danger" onClick={openUnpaidCustomers}><span>العملاء غير المدفوعين</span><strong>{unpaidCustomers.length}</strong><small>اضغط لعرضهم مباشرة</small></button>
        <button className="v17-command-card warning" onClick={()=>setActiveTab('res')}><span>الحجوزات المنتظرة</span><strong>{reservations.filter(r=>!r.isDistributed).length}</strong><small>متابعة الحجوزات</small></button>
        <button className="v17-command-card success" onClick={()=>setActiveTab('collect')}><span>مطلوب تحصيله</span><strong>{amountDue.toLocaleString()}</strong><small>EGP · افتح مركز التحصيل</small></button>
      </div>
      <Surface className="v19-home-summary">
        <div className="v17-panel-head"><div><h3>ملخص اليوم</h3><p>أهم أرقام التشغيل الحالية</p></div><button onClick={()=>setActiveTab('dash')} className="v16-btn v16-btn-soft">لوحة القيادة</button></div>
        <div className="v19-mini-stats"><div><span>المحصل</span><b>{totalRev.toLocaleString()} EGP</b></div><div><span>صافي الربح</span><b className={netProfit>=0?'positive':'negative'}>{netProfit.toLocaleString()} EGP</b></div><div><span>السعة المتبقية</span><b>{totalRemainingGB.toLocaleString()} GB</b></div><div><span>الباقات الإضافية</span><b>{totalExtraPackagesValue.toLocaleString()} EGP</b></div></div>
      </Surface>
      <div className="v17-shortcuts"><button onClick={()=>setActiveTab('cust')}>العملاء</button><button onClick={()=>setActiveTab('lines')}>الخطوط</button><button onClick={()=>setActiveTab('extra')}>الباقات الإضافية</button><button onClick={()=>setActiveTab('reports')}>التقارير</button><button onClick={()=>setActiveTab('backup')}>النسخ الاحتياطي</button></div>
    </div>
  );

  const renderDashboard = () => {
    const usagePct=Math.min(100,(totalAllocGB/totalAvailGB)*100||0);
    const collectionPct=expectedRev>0?Math.min(100,(totalRev/expectedRev)*100):0;
    return <div className="v16-page animate-fade-in">
      <PageHeader title="لوحة القيادة" description="صورة مختصرة وواضحة عن الأداء المالي والسعات والتحصيل." actions={<button onClick={handleArchiveMonth} className="v16-btn v16-btn-danger">{t.dash.archMonth}</button>} meta={<span>{reservations.length} حجز قيد المتابعة</span>}/>
      <div className="v16-finance-grid v19-finance-grid">
        <Surface className="v16-main-metric"><span>الإيرادات المحصلة</span><strong>{totalRev.toLocaleString()} <small>EGP</small></strong><div className="v16-progress"><i style={{width:`${collectionPct}%`}}></i></div><p>{collectionPct.toFixed(0)}% من الإيراد المتوقع</p></Surface>
        <Surface className="v16-metric-card success"><div><span>الربح الفعلي</span><strong>{netProfit.toLocaleString()}</strong><small>EGP</small></div><b>↗</b></Surface>
        
        <Surface className="v16-metric-card danger"><div><span>المصروفات والفواتير</span><strong>{totalExp.toLocaleString()}</strong><small>EGP</small></div><b>−</b></Surface>
      </div>
      <div className="v16-dashboard-split">
        <Surface className="v16-capacity-card">
          <div className="v16-card-head"><div><span>السعة</span><h3>استخدام الجيجات</h3></div><b>{usagePct.toFixed(1)}%</b></div>
          <div className="v16-capacity-numbers"><div><span>المتاح</span><strong>{totalAvailGB.toLocaleString()}</strong><small>GB</small></div><div><span>المستخدم</span><strong>{totalAllocGB.toLocaleString()}</strong><small>GB</small></div><div><span>المتبقي</span><strong>{totalRemainingGB.toLocaleString()}</strong><small>GB</small></div></div>
          <div className="v16-progress lg"><i style={{width:`${usagePct}%`}}></i></div>
        </Surface>
        <Surface className="v16-collection-card">
          <div className="v16-card-head"><div><span>التحصيل</span><h3>حالة العملاء</h3></div></div>
          <div className="v16-pay-ring"><div><strong>{paidCustCount}</strong><span>دفعوا</span></div><button type="button" onClick={openUnpaidCustomers}><strong>{unpCustCount}</strong><span>لم يدفعوا</span><small>عرض العملاء</small></button></div>
          <div className="v16-method-row"><span>InstaPay <small>{instaPayCount} عملية</small></span><b>{instaPaySum.toLocaleString()}</b></div>
          <div className="v16-method-row"><span>Vodafone Cash <small>{vfCashCount} عملية</small></span><b>{vfCashSum.toLocaleString()}</b></div>
        </Surface>
      </div>
      <div className="v16-mini-grid">
        <Surface><span>إجمالي العملاء</span><strong>{totalCustomersCount}</strong><i className="c1">◉</i></Surface>
        <Surface><span>الباقات الإضافية</span><strong>{totalExtraPackagesCount}</strong><i className="c2">＋</i></Surface>
        <Surface><span>جيجات الإضافيات</span><strong>{totalExtraGB.toLocaleString()} <small>GB</small></strong><i className="c3">GB</i></Surface>
        <Surface><span>قيمة الإضافيات</span><strong>{totalExtraPackagesValue.toLocaleString()} <small>EGP</small></strong><i className="c4">£</i></Surface>
      </div>
    </div>;
  };

  const renderLineStructure = () => {
    return (
    <div className="v16-page animate-fade-in">
      <PageHeader title="هيكلة الخطوط" description="متابعة السعة والعملاء والإيراد لكل خط في بطاقات واضحة." actions={<button onClick={()=>setActiveTab('lines_manage')} className="v16-btn v16-btn-primary">إدارة الخطوط</button>} meta={<span>{lines.length} خط · {totalAvailGB} GB إجمالي</span>}/>
      <div className="v16-lines-grid">
        {lines.map(line=>{
          const lineCusts=customers.filter(c=>c.lineId===line.id); const activeLineCusts=lineCusts.filter(c=>c.isActive!==false); const visibleBaseCusts=lineCusts.filter(c=>getEffectiveLineId(c)===line.id); const activeVisibleBaseCusts=visibleBaseCusts.filter(c=>c.isActive!==false); const movedInCusts=customers.filter(c=>c.lineId!==line.id&&getEffectiveLineId(c)===line.id); const activeMovedInCusts=movedInCusts.filter(c=>c.isActive!==false); const totalSlots=activeVisibleBaseCusts.length+activeMovedInCusts.length; let usedGb=activeLineCusts.reduce((s,c)=>s+(Number(packages.find(pkg=>pkg.id===c.packageId)?.gb)||0),0); usedGb+=extraPackages.filter(ex=>(ex.targetLineId||ex.lineId)===line.id&&ex.isActive!==false).reduce((s,ex)=>s+(Number(packages.find(pkg=>pkg.id===ex.packageId)?.gb)||0),0); const availGb=Number(line.baseGB||0)+Number(line.carriedGB||0); let lineRev=activeLineCusts.reduce((s,c)=>s+(Number(packages.find(pkg=>pkg.id===c.packageId)?.price)||0),0); lineRev+=extraPackages.filter(ex=>(ex.targetLineId||ex.lineId)===line.id&&ex.isActive!==false).reduce((s,ex)=>s+(Number(packages.find(pkg=>pkg.id===ex.packageId)?.price)||0),0); lineRev+=Number(line.extraRev||0); const lineInvoice=Number(line.invoice||0); const pct=Math.min(100,(usedGb/availGb)*100||0);
          return <Surface key={line.id} className="v16-line-card"><div className="v16-line-head v19-line-head"><div><span>{line.id}</span><h3>{line.name}</h3><p>{line.phone}</p><button className="v17-inline-detail" onClick={()=>setSelectedLine(line)}>عرض التفاصيل</button></div><Status tone={totalSlots>=6?'danger':'success'}>{totalSlots}/6</Status></div><div className="v16-line-cap"><div><span>{usedGb} GB مستخدم</span><span>{availGb} GB متاح</span></div><div className="v16-progress"><i style={{width:`${pct}%`}}></i></div></div><div className="v16-line-fin"><div><span>الإيراد</span><strong>{lineRev} EGP</strong></div><div><span>الصافي</span><strong className={lineRev-lineInvoice>=0?'positive':'negative'}>{lineRev-lineInvoice} EGP</strong></div></div><div className="v16-line-users">{visibleBaseCusts.map(c=>{const p=packages.find(pkg=>pkg.id===c.packageId);return <div key={c.id} className="v16-line-user"><span className="avatar">{(c.name||'?').charAt(0)}</span><div><strong>{c.name}</strong><small>{c.phone}</small></div><b>{p?.gb||0} GB</b></div>})}{movedInCusts.map(c=>{const cExtras=extraPackages.filter(ex=>ex.customerId===c.id&&ex.isActive!==false);const lastMoved=[...cExtras].reverse().find(ex=>ex.targetLineId===line.id);const p=packages.find(pkg=>pkg.id===lastMoved?.packageId);const originLine=lines.find(l=>l.id===c.lineId);return <div key={`m_${c.id}`} className="v16-line-user moved"><span className="avatar">{(c.name||'?').charAt(0)}</span><div><strong>{c.name}</strong><small>{c.phone}</small><small className="block">من {originLine?.name||'خط سابق'} · {originLine?.phone||'?'}</small></div><b>{p?.gb||0} GB</b></div>})}{totalSlots===0&&<EmptyState title="الخط متاح" text="لا يوجد عملاء على هذا الخط."/>}</div></Surface>
        })}
      </div>
    </div>
  );
  };

  const renderLinesManage = () => (
    <div className="v16-page animate-fade-in">
      <PageHeader title="إدارة الخطوط" description="أضف الخطوط وعدّل السعة والفاتورة والإيراد الإضافي." meta={<span>{lines.length} خط مسجل</span>}/>
      <div className="v16-two-column">
        <FormSection title="إضافة خط جديد" subtitle="بيانات الخط الأساسية" className="v16-sticky-form"><form onSubmit={handleAddLine} className="v16-form-stack"><Field label="اسم الخط"><input className={inputClass} placeholder="Ahmed-130-01" value={newLineData.name} onChange={e=>setNewLineData({...newLineData,name:e.target.value})} required/></Field><Field label={t.common.phone}><input className={inputClass} placeholder="رقم الخط" value={newLineData.phone} onChange={e=>setNewLineData({...newLineData,phone:e.target.value})} required/></Field><div className="v16-form-two"><Field label="السعة الأساسية"><input className={inputClass} type="number" placeholder="GB" value={newLineData.baseGB} onChange={e=>setNewLineData({...newLineData,baseGB:e.target.value})} required/></Field><Field label="الجيجات المرحلة"><input className={inputClass} type="number" placeholder="GB" value={newLineData.carriedGB} onChange={e=>setNewLineData({...newLineData,carriedGB:e.target.value})}/></Field></div><div className="v16-form-two"><Field label="فاتورة الخط"><input className={inputClass} type="number" placeholder="EGP" value={newLineData.invoice} onChange={e=>setNewLineData({...newLineData,invoice:e.target.value})} required/></Field><Field label="إيراد إضافي"><input className={inputClass} type="number" placeholder="EGP" value={newLineData.extraRev} onChange={e=>setNewLineData({...newLineData,extraRev:e.target.value})}/></Field></div><button className={btnClass}>إضافة الخط</button></form></FormSection>
        <div className="v16-list-stack">{lines.map(l=><Surface key={l.id} className="v16-list-card"><div className="v16-list-main"><span className="v16-list-icon">⌁</span><div><strong>{l.name}</strong><small>{l.phone} · {l.id}</small></div></div><div className="v16-line-tags"><span>{l.baseGB} GB أساسي</span><span>{l.carriedGB||0} GB مرحل</span><span>{l.invoice||0} EGP فاتورة</span></div><div className="v16-row-actions"><IconButton tone="blue" onClick={()=>setEditModal({isOpen:true,type:'line',data:l})}>✎</IconButton><IconButton tone="danger" onClick={()=>handleDelete('line',l.id)}>×</IconButton></div></Surface>)}{lines.length===0&&<Surface><EmptyState title="لا توجد خطوط" text="أضف أول خط من النموذج."/></Surface>}</div>
      </div>
    </div>
  );

  const renderSearch = () => {
    const q=(searchQuery||'').trim();
    const currentResult=(q&&searchScope!=='history')?customers.find(c=>(c.phone||'').includes(q)||(c.id||'').includes(q)):null;
    const rPkg=currentResult?packages.find(p=>p.id===currentResult.packageId):null;
    const rLine=currentResult?lines.find(l=>l.id===currentResult.lineId):null;
    const cExtras=currentResult?extraPackages.filter(ex=>ex.customerId===currentResult.id):[];
    const exGb=cExtras.reduce((sum,ex)=>sum+(Number(packages.find(p=>p.id===ex.packageId)?.gb)||0),0);
    const exRev=cExtras.reduce((sum,ex)=>sum+(Number(packages.find(p=>p.id===ex.packageId)?.price)||0),0);

    const archivedMatches=[];
    if(q&&searchScope!=='current'){
      archives.forEach((arc,archiveIndex)=>{
        const custs=Array.isArray(arc?.customersSnapshot)?arc.customersSnapshot:[];
        const lineSnap=Array.isArray(arc?.linesSnapshot)?arc.linesSnapshot:[];
        const pkgSnap=Array.isArray(arc?.packagesSnapshot)?arc.packagesSnapshot:[];
        const extraSnap=Array.isArray(arc?.extraPackagesSnapshot)?arc.extraPackagesSnapshot:[];
        custs.filter(c=>(c.phone||'').includes(q)||(c.id||'').includes(q)).forEach(c=>{
          const line=lineSnap.find(l=>l.id===c.lineId)||null;
          const pkg=pkgSnap.find(p=>p.id===c.packageId)||null;
          const extras=extraSnap.filter(ex=>ex.customerId===c.id);
          archivedMatches.push({arc,archiveIndex,customer:c,line,pkg,extras,lineSnap,pkgSnap});
        });
      });
      archivedMatches.sort((a,b)=>new Date(b.arc.date)-new Date(a.arc.date));
    }

    const updateSearchPayment=(field,value)=>{
      if(!currentResult) return;
      setCustomers(prev=>prev.map(c=>c.id===currentResult.id?{...c,[field]:value,...(field==='payStatus'&&value!=='Paid'?{payMethod:''}:{})}:c));
      recordActivity('تعديل حالة دفع من البحث',`${currentResult.name} · ${field}=${value}`);
    };
    const updateSearchExtraPayment=(extraId,field,value)=>{
      setExtraPackages(prev=>prev.map(ex=>ex.id===extraId?{...ex,[field]:value,...(field==='payStatus'&&value!=='Paid'?{payMethod:''}:{})}:ex));
      recordActivity('تعديل دفع باقة إضافية من البحث',`${extraId} · ${field}=${value}`);
    };

    const timeline=[...archivedMatches].reverse();
    if(currentResult){timeline.push({current:true,customer:currentResult,line:rLine,pkg:rPkg,extras:cExtras,arc:{date:new Date().toISOString()}})}

    return <div className="v16-page v16-search-page animate-fade-in">
      <PageHeader title="البحث" description="ابحث في الشهر الحالي أو الشهور السابقة واعرف مسار العميل بين الخطوط."/>
      <div className="v20-search-toolbar"><div className="v16-search-box"><span>⌕</span><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="اكتب رقم الموبايل أو كود العميل..."/></div><div className="v20-search-scope"><button className={searchScope==='current'?'active':''} onClick={()=>setSearchScope('current')}>الحالي</button><button className={searchScope==='history'?'active':''} onClick={()=>setSearchScope('history')}>الشهور السابقة</button><button className={searchScope==='all'?'active':''} onClick={()=>setSearchScope('all')}>الكل</button></div></div>

      {currentResult&&<div className="v16-search-result"><Surface className="v16-profile-card"><div className="v16-profile-top"><span className="v16-avatar-lg">{(currentResult.name||'?').charAt(0)}</span><div><h3>{currentResult.name}</h3><p>{currentResult.phone} · {currentResult.id}</p></div><Status tone={currentResult.payStatus==='Paid'||currentResult.payStatus==='مدفوع'?'success':'danger'}>{currentResult.payStatus}</Status></div><div className="v16-profile-grid"><div><span>الباقة</span><strong>{rPkg?.name||'غير محدد'}</strong></div><div><span>الخط الحالي</span><strong>{rLine?`${rLine.name} · ${rLine.phone}`:'غير محدد'}</strong></div><div><span>إضافيات</span><strong>{exGb} GB</strong></div><div><span>إجمالي الفواتير</span><strong>{(Number(rPkg?.price)||0)+exRev} EGP</strong></div></div><div className="v18-search-payment"><Field label="حالة الدفع"><select className={inputClass} value={currentResult.payStatus} onChange={e=>updateSearchPayment('payStatus',e.target.value)}><option value="Unpaid">غير مدفوع</option><option value="Paid">مدفوع</option></select></Field>{(currentResult.payStatus==='Paid'||currentResult.payStatus==='مدفوع')&&<Field label="طريقة الدفع"><select className={inputClass} value={currentResult.payMethod||''} onChange={e=>updateSearchPayment('payMethod',e.target.value)}><option value="">اختر</option><option value="InstaPay">InstaPay</option><option value="Vodafone Cash">Vodafone Cash</option></select></Field>}</div><div className="v16-profile-actions"><button onClick={()=>setEditModal({isOpen:true,type:'customer',data:currentResult})} className="v16-btn v16-btn-soft">تعديل باقي البيانات</button><button onClick={()=>handleDelete('customer',currentResult.id)} className="v16-btn v16-btn-danger-soft">حذف</button></div></Surface><Surface className="v16-extras-card"><div className="v16-card-head"><div><span>السجل الحالي</span><h3>الباقات الإضافية</h3></div><Status>{cExtras.length} باقة</Status></div><div className="v16-activity-list v19-extra-search-list">{cExtras.map(ex=>{const currentLine=lines.find(l=>l.id===(ex.targetLineId||ex.lineId));return <div key={ex.id}><span className="dot"></span><div className="v19-extra-search-copy"><strong>{packages.find(pkg=>pkg.id===ex.packageId)?.name}</strong><small>{ex.date} · {currentLine?`${currentLine.name} · ${currentLine.phone}`:'خط غير محدد'}</small></div><div className="v19-extra-payment-controls"><select className={inputClass} value={ex.payStatus||'Unpaid'} onChange={e=>updateSearchExtraPayment(ex.id,'payStatus',e.target.value)}><option value="Unpaid">غير مدفوع</option><option value="Paid">مدفوع</option></select>{ex.payStatus==='Paid'&&<select className={inputClass} value={ex.payMethod||''} onChange={e=>updateSearchExtraPayment(ex.id,'payMethod',e.target.value)}><option value="">اختر طريقة الدفع</option><option value="InstaPay">InstaPay</option><option value="Vodafone Cash">Vodafone Cash</option></select>}</div></div>})}{cExtras.length===0&&<EmptyState title="لا توجد إضافيات" text="لا توجد باقات إضافية لهذا العميل."/>}</div></Surface></div>}

      {q&&archivedMatches.length>0&&<Surface className="v20-history-panel"><div className="v16-card-head"><div><span>الأرشيف</span><h3>نتائج الشهور السابقة</h3></div><Status>{archivedMatches.length} سجل</Status></div><div className="v20-history-list">{archivedMatches.map((item,idx)=>{const totalExtraGb=item.extras.reduce((sum,ex)=>sum+(Number(item.pkgSnap.find(p=>p.id===ex.packageId)?.gb)||0),0);return <div className="v20-history-row" key={`${item.archiveIndex}_${item.customer.id}`}><div className="v20-history-date"><strong>{new Date(item.arc.date).toLocaleDateString('ar-EG',{month:'long',year:'numeric'})}</strong><small>{item.customer.name}</small></div><div><span>الخط</span><strong>{item.line?`${item.line.name} · ${item.line.phone}`:'غير محدد'}</strong></div><div><span>الباقة</span><strong>{item.pkg?.name||'غير محدد'}</strong></div><div><span>الإضافيات</span><strong>{item.extras.length} · {totalExtraGb} GB</strong></div><div><span>الدفع</span><strong>{item.customer.payStatus}{item.customer.payMethod?` · ${item.customer.payMethod}`:''}</strong></div></div>})}</div></Surface>}

      {q&&timeline.length>1&&<Surface className="v20-movement-panel"><div className="v16-card-head"><div><span>Timeline</span><h3>حركة العميل بين الخطوط</h3></div></div><div className="v20-movement-list">{timeline.map((item,idx)=>{const prev=idx>0?timeline[idx-1]:null;const moved=prev?.line?.id&&item?.line?.id&&prev.line.id!==item.line.id;return <div key={`tl_${idx}`} className={moved?'moved':''}><i></i><div><strong>{item.current?'الشهر الحالي':new Date(item.arc.date).toLocaleDateString('ar-EG',{month:'long',year:'numeric'})}</strong><span>{item.line?`${item.line.name} · ${item.line.phone}`:'خط غير محدد'}</span>{moved&&<small>تم النقل من {prev.line.name} · {prev.line.phone}</small>}</div></div>})}</div></Surface>}

      {q&&!currentResult&&archivedMatches.length===0&&<Surface><EmptyState icon="⌕" title="لم يتم العثور على العميل" text="لم نجد نتيجة في الشهر الحالي أو الأرشيف المتاح. الأرشيفات القديمة التي أُنشئت قبل هذه النسخة قد لا تحتوي تفاصيل العملاء."/></Surface>}
    </div>;
  };

  const renderArchive = () => <div className="v16-page animate-fade-in"><PageHeader title="الأرشيف" description="السجل الشهري للإيرادات والمصروفات وصافي الربح." meta={<span>{archives.length} سجل</span>}/>{archives.length>0?<div className="v16-archive-grid">{archives.map((arc,idx)=><Surface key={idx} className="v16-archive-card"><div className="v16-archive-date"><span>{new Date(arc.date).toLocaleString(isArabic?'ar-EG':'en-US',{month:'long'})}</span><strong>{new Date(arc.date).getFullYear()}</strong></div><div className="v16-archive-values"><div><span>الإيرادات</span><strong className="positive">{arc.stats.totalRev}</strong></div><div><span>المصروفات</span><strong className="negative">{arc.stats.totalExp}</strong></div><div><span>الصافي</span><strong>{arc.stats.netProfit}</strong></div></div></Surface>)}</div>:<Surface><EmptyState title="الأرشيف فارغ" text="سيظهر هنا سجل الشهور بعد تقفيلها."/></Surface>}</div>;

  const renderBackup = () => <div className="v16-page animate-fade-in"><PageHeader title="حفظ البيانات" description="نسخ محلية وSnapshots سحابية تلقائية مع استمرار المزامنة."/><div className="v16-backup-grid"><Surface className="v16-backup-card primary"><span className="v16-backup-icon">↓</span><div><h3>تنزيل نسخة احتياطية</h3><p>احفظ كل بيانات النظام في ملف JSON على جهازك.</p></div><button onClick={handleExportData} className="v16-btn v16-btn-primary">تصدير البيانات</button></Surface><Surface className="v16-backup-card"><span className="v16-backup-icon alt">↑</span><div><h3>استرجاع نسخة محفوظة</h3><p>اختر ملف JSON سابق وسيتم استعادته بنفس منطق النظام الحالي.</p></div><label className="v16-btn v16-btn-soft cursor-pointer">اختيار ملف JSON<input type="file" accept=".json" className="hidden" onChange={handleImportData}/></label></Surface><Surface className="v16-backup-card"><span className="v16-backup-icon">☁</span><div><h3>Snapshot سحابي تلقائي</h3><p>يتم حفظ Snapshot تلقائيًا مرة يوميًا داخل Firebase بدون استبدال الحالة الحية.</p></div><button onClick={restoreLatestCloudSnapshot} className="v16-btn v16-btn-soft">استرجاع آخر Snapshot</button></Surface></div></div>;

  const renderCustomers = () => {
    const filteredCustomers=customers.filter(c=>custFilter==='booked'?c.isConfirmed===true:custFilter==='unbooked'?c.isConfirmed!==true:custFilter==='unpaid'?(c.payStatus!=='Paid'&&c.payStatus!=='مدفوع'):true);
    return <div className="v16-page animate-fade-in"><PageHeader title="العملاء" description="إضافة ومتابعة العملاء وحالة الدفع والحجز." actions={<><button onClick={handleExportCustomers} className="v16-btn v16-btn-soft success">تصدير إكسيل</button><button onClick={()=>setConfirmModal({isOpen:true,type:'clear_all_cust',title:isArabic?'مسح جميع العملاء':'Clear All Customers',onConfirm:()=>{setCustomers([]);setConfirmModal({isOpen:false,type:'',id:null});}})} className="v16-btn v16-btn-danger-soft">مسح الجميع</button></>} meta={<span>{customers.length} عميل</span>}/><div className="v16-filter-row"><button onClick={()=>setCustFilter('all')} className={custFilter==='all'?'active':''}>الكل <b>{customers.length}</b></button><button onClick={()=>setCustFilter('booked')} className={custFilter==='booked'?'active':''}>الحاجزين <b>{customers.filter(c=>c.isConfirmed===true).length}</b></button><button onClick={()=>setCustFilter('unbooked')} className={custFilter==='unbooked'?'active':''}>غير الحاجزين <b>{customers.filter(c=>c.isConfirmed!==true).length}</b></button><button onClick={()=>setCustFilter('unpaid')} className={custFilter==='unpaid'?'active':''}>غير المدفوعين <b>{unpaidCustomers.length}</b></button></div><div className="v16-two-column wide-list"><FormSection title="عميل جديد" subtitle="أدخل بيانات العميل" className="v16-sticky-form"><form onSubmit={handleAddCust} className="v16-form-stack"><Field label={t.common.name}><input className={inputClass} placeholder="اسم العميل" value={newCustData.name} onChange={e=>setNewCustData({...newCustData,name:e.target.value})} required/></Field><Field label={t.common.phone}><input className={inputClass} placeholder="01xxxxxxxxx" value={newCustData.phone} onChange={e=>setNewCustData({...newCustData,phone:e.target.value})} required/></Field><Field label="الباقة"><select className={inputClass} value={newCustData.packageId} onChange={e=>setNewCustData({...newCustData,packageId:e.target.value})} required><option value="">{t.common.choose}</option>{packages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="الخط"><select className={inputClass} value={newCustData.lineId} onChange={e=>setNewCustData({...newCustData,lineId:e.target.value})} required><option value="">{t.common.choose}</option>{lines.map(l=><option key={l.id} value={l.id}>{l.name} ({l.phone})</option>)}</select></Field><div className="v16-form-two"><Field label="حالة الدفع"><select className={inputClass} value={newCustData.payStatus} onChange={e=>setNewCustData({...newCustData,payStatus:e.target.value})}><option value="Unpaid">غير مدفوع</option><option value="Paid">مدفوع</option></select></Field>{newCustData.payStatus==='Paid'&&<Field label="طريقة الدفع"><select className={inputClass} value={newCustData.payMethod} onChange={e=>setNewCustData({...newCustData,payMethod:e.target.value})}><option value="">اختر</option><option value="InstaPay">InstaPay</option><option value="Vodafone Cash">Vodafone Cash</option></select></Field>}</div><button className={btnClass}>إضافة العميل</button></form></FormSection><Surface className="v16-table-surface"><div className="v16-table-head"><div><h3>قائمة العملاء</h3><p>{filteredCustomers.length} نتيجة</p></div></div><div className="overflow-x-auto"><table className="v16-table"><thead><tr><th>العميل</th><th>الباقة</th><th>الخط</th><th>الشهر الجديد</th><th>الدفع</th><th></th></tr></thead><tbody>{filteredCustomers.map(c=><tr key={c.id}><td><div className="v16-person"><span>{(c.name||'?').charAt(0)}</span><div><button className="v17-link-title" onClick={()=>setSelectedCustomer(c)}>{c.name}</button><small>{c.phone} · {c.id}</small></div></div></td><td><Status tone="brand">{packages.find(p=>p.id===c.packageId)?.name||'غير محدد'}</Status></td><td><strong>{lines.find(l=>l.id===c.lineId)?.phone}</strong><small className="block">{lines.find(l=>l.id===c.lineId)?.name}</small></td><td><button onClick={()=>handleToggleBooking(c)}><Status tone={c.isConfirmed===true?'success':'danger'}>{c.isConfirmed===true?'حاجز':'لم يحجز'}</Status></button></td><td><Status tone={c.payStatus==='Paid'||c.payStatus==='مدفوع'?'success':'danger'}>{c.payStatus}{c.payMethod?` · ${c.payMethod}`:''}</Status></td><td><div className="v16-row-actions"><IconButton tone="blue" onClick={()=>setEditModal({isOpen:true,type:'customer',data:c})}>✎</IconButton><IconButton tone="danger" onClick={()=>handleDelete('customer',c.id)}>×</IconButton></div></td></tr>)}{filteredCustomers.length===0&&<tr><td colSpan="6"><EmptyState title="لا يوجد عملاء" text="لا توجد بيانات مطابقة للفلتر الحالي."/></td></tr>}</tbody></table></div></Surface></div></div>;
  };

  const renderReservations = () => {
    const pendingGb=reservations.filter(r=>!r.isDistributed).reduce((sum,r)=>sum+(Number(packages.find(p=>p.id===r.packageId)?.gb)||0),0);
    return <div className="v16-page animate-fade-in"><PageHeader title="الحجوزات" description="قائمة الانتظار والتوجيه والتوزيع التلقائي." actions={<>{reservations.length>0&&<button onClick={handleDistributeReservations} className="v16-btn v16-btn-primary success">تفعيل وتوزيع تلقائي</button>}{reservations.length>0&&<button onClick={handleArchiveReservations} className="v16-btn v16-btn-danger-soft">مسح الحجوزات</button>}</>} meta={<span>{reservations.length} حجز · {pendingGb} GB</span>}/>{distributeMessage&&<div className="v16-alert success">{distributeMessage}</div>}<div className="v16-two-column wide-list"><FormSection title="حجز جديد" subtitle="إضافة إلى قائمة الانتظار" className="v16-sticky-form"><form onSubmit={handleAddRes} className="v16-form-stack"><Field label={t.common.name}><input className={inputClass} placeholder="اسم الحاجز" value={newResData.name} onChange={e=>setNewResData({...newResData,name:e.target.value})} required/></Field><Field label={t.common.phone}><input className={inputClass} placeholder="01xxxxxxxxx" value={newResData.phone} onChange={e=>setNewResData({...newResData,phone:e.target.value})} required/></Field><Field label="الباقة"><select className={inputClass} value={newResData.packageId} onChange={e=>setNewResData({...newResData,packageId:e.target.value})} required><option value="">{t.common.choose}</option>{packages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="حالة الدفع"><select className={inputClass} value={newResData.payStatus} onChange={e=>setNewResData({...newResData,payStatus:e.target.value})}><option value="Unpaid">غير مدفوع</option><option value="Paid">مدفوع</option></select></Field>{newResData.payStatus==='Paid'&&<Field label="طريقة الدفع"><select className={inputClass} value={newResData.payMethod} onChange={e=>setNewResData({...newResData,payMethod:e.target.value})}><option value="">اختر</option><option value="InstaPay">InstaPay</option><option value="Vodafone Cash">Vodafone Cash</option></select></Field>}<button className={btnClass}>إضافة الحجز</button></form></FormSection><Surface className="v16-table-surface"><div className="overflow-x-auto"><table className="v16-table"><thead><tr><th>العميل</th><th>الباقة</th><th>التوجيه</th><th>الحالة</th><th></th></tr></thead><tbody>{reservations.map(r=><tr key={r.id} className={r.isDistributed?'muted-row':''}><td><div className="v16-person"><span>{(r.name||'?').charAt(0)}</span><div><strong>{r.name}</strong><small>{r.phone}</small></div></div></td><td><Status tone="brand">{packages.find(p=>p.id===r.packageId)?.name}</Status></td><td><select disabled={r.isDistributed} className={inputClass} value={r.manualLineId||''} onChange={e=>setReservations(reservations.map(res=>res.id===r.id?{...res,manualLineId:e.target.value}:res))}><option value="">تلقائي</option>{lines.map(l=><option key={l.id} value={l.id}>{l.phone} - {l.name}</option>)}</select></td><td><Status tone={r.isDistributed?'success':'warning'}>{r.isDistributed?'تم التفعيل':'في الانتظار'}</Status></td><td><div className="v16-row-actions"><IconButton tone="blue" onClick={()=>setEditModal({isOpen:true,type:'reservation',data:r})}>✎</IconButton><IconButton tone="danger" onClick={()=>handleDelete('reservation',r.id)}>×</IconButton></div></td></tr>)}{reservations.length===0&&<tr><td colSpan="5"><EmptyState title="لا توجد حجوزات" text="قائمة الانتظار فارغة حاليًا."/></td></tr>}</tbody></table></div></Surface></div></div>;
  };

  const renderPackages = () => <div className="v16-page animate-fade-in"><PageHeader title="الباقات" description="إدارة الخطط والسعات والدقائق والأسعار." meta={<span>{packages.length} باقة</span>}/><div className="v16-package-layout"><FormSection title="باقة جديدة" subtitle="أضف خطة جديدة" className="v16-package-form"><form onSubmit={handleAddPkg} className="v16-form-stack"><Field label="اسم الباقة"><input className={inputClass} placeholder="مثال: 30 GB" value={newPkgData.name} onChange={e=>setNewPkgData({...newPkgData,name:e.target.value})} required/></Field><div className="v16-form-two"><Field label="السعة"><input className={inputClass} type="number" placeholder="GB" value={newPkgData.gb} onChange={e=>setNewPkgData({...newPkgData,gb:e.target.value})} required/></Field><Field label="الدقائق"><input className={inputClass} type="number" placeholder="Minutes" value={newPkgData.mins} onChange={e=>setNewPkgData({...newPkgData,mins:e.target.value})}/></Field></div><Field label="السعر"><input className={inputClass} type="number" placeholder="EGP" value={newPkgData.price} onChange={e=>setNewPkgData({...newPkgData,price:e.target.value})} required/></Field><button className={btnClass}>إضافة الباقة</button></form></FormSection><div className="v16-pricing-grid">{packages.map((p,index)=><Surface key={p.id} className={`v16-price-card ${index===1?'featured':''}`}><div className="v16-price-top"><span>{p.gb} GB</span><div className="v16-row-actions"><IconButton tone="blue" onClick={()=>setEditModal({isOpen:true,type:'package',data:p})}>✎</IconButton><IconButton tone="danger" onClick={()=>handleDelete('package',p.id)}>×</IconButton></div></div><h3>{p.name}</h3><p>{p.mins?`${p.mins} دقيقة`:'بدون دقائق مسجلة'}</p><div className="v16-price"><strong>{p.price}</strong><span>EGP</span></div></Surface>)}</div></div></div>;

  const renderExpenses = () => { const totalExpensesOnly=expenses.reduce((sum,e)=>sum+Number(e.amount||0),0); return <div className="v16-page animate-fade-in"><PageHeader title="المصروفات" description="سجل واضح لكل التكاليف التشغيلية." meta={<span>{expenses.length} مصروف · {totalExpensesOnly.toLocaleString()} EGP</span>}/><div className="v16-two-column"><FormSection title="مصروف جديد" subtitle="أضف تكلفة تشغيلية" className="v16-sticky-form"><form onSubmit={handleAddExp} className="v16-form-stack"><Field label="وصف المصروف"><input className={inputClass} placeholder="وصف المصروف" value={newExpData.description} onChange={e=>setNewExpData({...newExpData,description:e.target.value})} required/></Field><Field label="المبلغ"><input className={inputClass} type="number" placeholder="EGP" value={newExpData.amount} onChange={e=>setNewExpData({...newExpData,amount:e.target.value})} required/></Field><button className={btnClass}>إضافة المصروف</button></form></FormSection><div className="v16-list-stack">{expenses.map(ex=><Surface key={ex.id} className="v16-expense-row"><span className="v16-expense-icon">−</span><div className="v16-expense-copy"><strong>{ex.description}</strong><small>{ex.date}</small></div><b>{Number(ex.amount).toLocaleString()} <small>EGP</small></b><div className="v16-row-actions"><IconButton tone="blue" onClick={()=>setEditModal({isOpen:true,type:'expense',data:ex})}>✎</IconButton><IconButton tone="danger" onClick={()=>handleDelete('expense',ex.id)}>×</IconButton></div></Surface>)}{expenses.length===0&&<Surface><EmptyState title="لا توجد مصروفات" text="لم يتم تسجيل مصروفات حتى الآن."/></Surface>}</div></div></div> };

  const renderExtra = () => { const matchedCust=newExtraData.customerSearch?customers.find(c=>c.phone.includes(newExtraData.customerSearch)||c.id.includes(newExtraData.customerSearch)):null; const filteredExtras=extraPackages.filter(ex=>extraFilter==='unpaid'?(ex.payStatus!=='Paid'&&ex.payStatus!=='مدفوع'):extraFilter==='paid'?(ex.payStatus==='Paid'||ex.payStatus==='مدفوع'):true); return <div className="v16-page animate-fade-in"><PageHeader title="الباقات الإضافية" description="إضافة باقات للعملاء ومتابعة الخط والتحصيل." meta={<span>{totalExtraPackagesCount} إضافة · {totalExtraPackagesValue.toLocaleString()} EGP</span>}/>{extraError&&<div className="v16-alert danger">{extraError}</div>}<div className="v16-filter-row"><button onClick={()=>setExtraFilter('all')} className={extraFilter==='all'?'active':''}>الكل <b>{extraPackages.length}</b></button><button onClick={()=>setExtraFilter('unpaid')} className={extraFilter==='unpaid'?'active':''}>غير المدفوعين <b>{extraPackages.filter(ex=>ex.payStatus!=='Paid'&&ex.payStatus!=='مدفوع').length}</b></button><button onClick={()=>setExtraFilter('paid')} className={extraFilter==='paid'?'active':''}>المدفوعين <b>{extraPackages.filter(ex=>ex.payStatus==='Paid'||ex.payStatus==='مدفوع').length}</b></button></div><div className="v16-two-column wide-list"><FormSection title="إضافة جديدة" subtitle="اختر العميل والباقة" className="v16-sticky-form"><form onSubmit={handleAddExtra} className="v16-form-stack"><Field label="بحث عن العميل"><input list="customers-list" className={inputClass} placeholder="رقم الموبايل أو ID" value={newExtraData.customerSearch} onChange={e=>setNewExtraData({...newExtraData,customerSearch:e.target.value})} required autoComplete="off"/><datalist id="customers-list">{customers.map(c=><option key={c.id} value={c.phone}>{c.name} ({c.id})</option>)}</datalist>{matchedCust&&<p className="v16-found">✓ {matchedCust.name}</p>}</Field><Field label="الباقة"><select className={inputClass} value={newExtraData.packageId} onChange={e=>setNewExtraData({...newExtraData,packageId:e.target.value})} required><option value="">{t.common.choose}</option>{packages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="الخط المحمل عليه"><select className={inputClass} value={newExtraData.targetLineId} onChange={e=>setNewExtraData({...newExtraData,targetLineId:e.target.value})}><option value="">نفس الخط الأساسي</option>{lines.map(l=><option key={l.id} value={l.id}>{l.name} ({l.phone})</option>)}</select></Field><Field label="حالة الدفع"><select className={inputClass} value={newExtraData.payStatus} onChange={e=>setNewExtraData({...newExtraData,payStatus:e.target.value})}><option value="Unpaid">غير مدفوع</option><option value="Paid">مدفوع</option></select></Field>{newExtraData.payStatus==='Paid'&&<Field label="طريقة الدفع"><select className={inputClass} value={newExtraData.payMethod} onChange={e=>setNewExtraData({...newExtraData,payMethod:e.target.value})}><option value="">اختر</option><option value="InstaPay">InstaPay</option><option value="Vodafone Cash">Vodafone Cash</option></select></Field>}<button className={btnClass}>إضافة الباقة الإضافية</button></form></FormSection><Surface className="v16-table-surface"><div className="overflow-x-auto"><table className="v16-table"><thead><tr><th>العميل</th><th>الباقة</th><th>الخط</th><th>الدفع</th><th></th></tr></thead><tbody>{filteredExtras.map(ex=>{const c=customers.find(cust=>cust.id===ex.customerId);const l=lines.find(line=>line.id===ex.targetLineId);const oldL=lines.find(line=>line.id===ex.lineId);const currentLine=lines.find(line=>line.id===(ex.targetLineId||ex.lineId));return <tr key={ex.id}><td><div className="v16-person"><span>{(c?.name||'?').charAt(0)}</span><div><strong>{c?.name}</strong><small>{c?.phone}</small></div></div></td><td><Status tone="brand">{packages.find(p=>p.id===ex.packageId)?.name}</Status></td><td><strong>{currentLine?.name||'—'}</strong><small className="block">{currentLine?.phone||'—'}</small></td><td><Status tone={ex.payStatus==='Paid'||ex.payStatus==='مدفوع'?'success':'danger'}>{ex.payStatus}{ex.payMethod?` · ${ex.payMethod}`:''}</Status></td><td><div className="v16-row-actions"><IconButton tone="blue" onClick={()=>setEditModal({isOpen:true,type:'extra',data:ex})}>✎</IconButton><IconButton tone="danger" onClick={()=>handleDelete('extra',ex.id)}>×</IconButton></div></td></tr>})}{filteredExtras.length===0&&<tr><td colSpan="5"><EmptyState title="لا توجد باقات إضافية" text="ابدأ بإضافة أول باقة إضافية."/></td></tr>}</tbody></table></div></Surface></div></div> };

  const renderCollections = () => {
    const unpaidExtras = extraPackages.filter(ex => ex.payStatus !== 'Paid' && ex.payStatus !== 'مدفوع');
    return <div className="v16-page animate-fade-in">
      <PageHeader title="مركز التحصيل" description="العملاء والباقات الإضافية غير المحصلة، كل نوع في قسم مستقل." meta={<span>{unpaidCustomers.length} عميل · {unpaidExtras.length} باقة إضافية · {amountDue.toLocaleString()} EGP</span>}/>
      <div className="v17-collection-summary"><Surface><span>مطلوب من العملاء</span><strong>{unpaidBaseAmount.toLocaleString()} EGP</strong></Surface><Surface><span>مطلوب من الباقات الإضافية</span><strong>{unpaidExtrasAmount.toLocaleString()} EGP</strong></Surface><Surface><span>إجمالي المطلوب</span><strong>{amountDue.toLocaleString()} EGP</strong></Surface></div>
      <div className="v18-collection-section"><div className="v18-section-title"><div><span className="v18-type-badge customer">عملاء</span><h3>اشتراكات العملاء غير المحصلة</h3></div><b>{unpaidCustomers.length}</b></div><Surface className="v16-table-surface"><div className="overflow-x-auto"><table className="v16-table"><thead><tr><th>العميل</th><th>الباقة</th><th>الخط</th><th>المطلوب</th><th></th></tr></thead><tbody>{unpaidCustomers.map(c=>{const p=packages.find(x=>x.id===c.packageId);const l=lines.find(x=>x.id===c.lineId);return <tr key={c.id}><td><button className="v17-link-title" onClick={()=>setSelectedCustomer(c)}>{c.name}</button><small className="block">{c.phone}</small></td><td>{p?.name||'—'}</td><td><strong>{l?.name||'—'}</strong><small className="block">{l?.phone||'—'}</small></td><td><strong>{Number(p?.price||0).toLocaleString()} EGP</strong></td><td><button onClick={()=>setEditModal({isOpen:true,type:'customer',data:c})} className="v16-btn v16-btn-soft">تعديل الدفع</button></td></tr>})}{!unpaidCustomers.length&&<tr><td colSpan="5"><EmptyState title="كل العملاء مدفوعون" text="لا يوجد مبالغ أساسية معلقة حاليًا."/></td></tr>}</tbody></table></div></Surface></div>
      <div className="v18-collection-section"><div className="v18-section-title"><div><span className="v18-type-badge extra">باقات إضافية</span><h3>الباقات الإضافية غير المحصلة</h3></div><b>{unpaidExtras.length}</b></div><Surface className="v16-table-surface"><div className="overflow-x-auto"><table className="v16-table"><thead><tr><th>العميل</th><th>الباقة الإضافية</th><th>الخط المحمل عليه</th><th>المطلوب</th><th></th></tr></thead><tbody>{unpaidExtras.map(ex=>{const c=customers.find(x=>x.id===ex.customerId);const p=packages.find(x=>x.id===ex.packageId);const l=lines.find(x=>x.id===(ex.targetLineId||ex.lineId));return <tr key={ex.id}><td><strong>{c?.name||'—'}</strong><small className="block">{c?.phone||'—'}</small><span className="v18-inline-extra">باقة إضافية</span></td><td>{p?.name||'—'}</td><td><strong>{l?.name||'—'}</strong><small className="block">{l?.phone||'—'}</small></td><td><strong>{Number(p?.price||0).toLocaleString()} EGP</strong></td><td><button onClick={()=>setEditModal({isOpen:true,type:'extra',data:ex})} className="v16-btn v16-btn-soft">تعديل الدفع</button></td></tr>})}{!unpaidExtras.length&&<tr><td colSpan="5"><EmptyState title="كل الإضافيات مدفوعة" text="لا توجد باقات إضافية معلقة حاليًا."/></td></tr>}</tbody></table></div></Surface></div>
    </div>;
  };

  const renderReports = () => {
    const topTenCustomers = customers.map(c => {
      const basePkg = packages.find(p=>p.id===c.packageId);
      const extras = extraPackages.filter(ex=>ex.customerId===c.id && ex.isActive!==false);
      const extraValue = extras.reduce((sum,ex)=>sum+Number(packages.find(p=>p.id===ex.packageId)?.price||0),0);
      const extraGb = extras.reduce((sum,ex)=>sum+Number(packages.find(p=>p.id===ex.packageId)?.gb||0),0);
      return { customer:c, baseValue:Number(basePkg?.price||0), baseName:basePkg?.name||'غير محدد', extraValue, extraGb, extrasCount:extras.length, total:Number(basePkg?.price||0)+extraValue };
    }).sort((a,b)=>b.total-a.total).slice(0,10);
    return (
    <div className="v16-page animate-fade-in">
      <PageHeader title="التقارير الشهرية" description="ملخص جاهز للطباعة أو الحفظ PDF والتصدير لإكسيل/CSV." actions={<><button onClick={()=>window.print()} className="v16-btn v16-btn-soft">طباعة / PDF</button><button onClick={exportMonthlyReportCsv} className="v16-btn v16-btn-primary">تصدير Excel CSV</button></>}/>
      <div className="v17-report-grid"><Surface><span>الإيرادات المحصلة</span><strong>{totalRev.toLocaleString()} EGP</strong></Surface><Surface><span>الإيرادات المتوقعة</span><strong>{expectedRev.toLocaleString()} EGP</strong></Surface><Surface><span>المصروفات والفواتير</span><strong>{totalExp.toLocaleString()} EGP</strong></Surface><Surface><span>صافي الربح</span><strong>{netProfit.toLocaleString()} EGP</strong></Surface><Surface><span>قيمة الباقات الإضافية</span><strong>{totalExtraPackagesValue.toLocaleString()} EGP</strong></Surface><Surface><span>مطلوب تحصيله</span><strong>{amountDue.toLocaleString()} EGP</strong></Surface></div>
      <Surface className="v17-report-sheet"><div className="v17-panel-head"><div><h3>تقرير التشغيل الحالي</h3><p>{new Date().toLocaleDateString('ar-EG',{month:'long',year:'numeric'})}</p></div></div><div className="v17-report-lines"><div><span>إجمالي العملاء</span><b>{customers.length}</b></div><div><span>المدفوعون</span><b>{paidCustCount}</b></div><div><span>غير المدفوعين</span><b>{unpaidCustomers.length}</b></div><div><span>الحجوزات</span><b>{reservations.length}</b></div><div><span>السعة المتبقية</span><b>{totalRemainingGB.toLocaleString()} GB</b></div><div><span>InstaPay</span><b>{instaPaySum.toLocaleString()} EGP</b></div><div><span>Vodafone Cash</span><b>{vfCashSum.toLocaleString()} EGP</b></div></div></Surface>
      <Surface className="v19-topten"><div className="v17-panel-head"><div><h3>Top 10 - الباقات الأساسية + الإضافية</h3><p>أعلى 10 عملاء حسب إجمالي قيمة الباقة الأساسية والباقات الإضافية الحالية.</p></div></div><div className="overflow-x-auto"><table className="v16-table"><thead><tr><th>#</th><th>العميل</th><th>الباقة الأساسية</th><th>الإضافيات</th><th>إجمالي الباقات</th></tr></thead><tbody>{topTenCustomers.map((row,index)=><tr key={row.customer.id}><td><strong>{index+1}</strong></td><td><strong>{row.customer.name}</strong><small className="block">{row.customer.phone}</small></td><td>{row.baseName}<small className="block">{row.baseValue.toLocaleString()} EGP</small></td><td>{row.extrasCount} باقة · {row.extraGb.toLocaleString()} GB<small className="block">{row.extraValue.toLocaleString()} EGP</small></td><td><strong>{row.total.toLocaleString()} EGP</strong></td></tr>)}{!topTenCustomers.length&&<tr><td colSpan="5"><EmptyState title="لا توجد بيانات" text="سيظهر الترتيب بعد إضافة العملاء والباقات."/></td></tr>}</tbody></table></div></Surface>
    </div>
    );
  };

  const deleteTrashItemPermanently = (trashId) => {
    setConfirmModal({isOpen:true,type:'delete_trash',title:'حذف نهائي',message:'سيتم حذف هذا العنصر نهائيًا من سلة المحذوفات ولن يمكن استرجاعه.',onConfirm:()=>{setTrashBin(prev=>prev.filter(t=>t.id!==trashId));setConfirmModal({isOpen:false,type:'',id:null});}});
  };
  const clearTrashPermanently = () => {
    if(!trashBin.length) return;
    setConfirmModal({isOpen:true,type:'clear_trash',title:'مسح سلة المحذوفات',message:`سيتم حذف ${trashBin.length} عنصر نهائيًا ولن يمكن استرجاعهم.`,onConfirm:()=>{setTrashBin([]);setConfirmModal({isOpen:false,type:'',id:null});}});
  };
  const renderTrash = () => <div className="v16-page animate-fade-in"><PageHeader title="سلة المحذوفات" description="استرجع العناصر أو احذفها نهائيًا عند عدم الحاجة إليها." actions={trashBin.length>0?<button onClick={clearTrashPermanently} className="v16-btn v16-btn-danger">مسح الكل نهائيًا</button>:null} meta={<span>{trashBin.length} عنصر</span>}/><div className="v17-trash-list">{trashBin.map(t=><Surface key={t.id} className="v17-trash-row"><div><strong>{t.item?.name || t.item?.description || t.item?.phone || t.type}</strong><span>{t.type} · {new Date(t.deletedAt).toLocaleString('ar-EG')}</span></div><div className="v19-trash-actions"><button onClick={()=>restoreTrashItem(t.id)} className="v16-btn v16-btn-soft success">استرجاع</button><button onClick={()=>deleteTrashItemPermanently(t.id)} className="v16-btn v16-btn-danger-soft">حذف نهائي</button></div></Surface>)}{!trashBin.length&&<Surface><EmptyState title="السلة فارغة" text="لا توجد عناصر محذوفة قابلة للاسترجاع."/></Surface>}</div></div>;

  if (firebaseEnabled && !authReady) {
    return <div className={`br-app-shell min-h-screen flex items-center justify-center ${isDarkMode ? 'theme-dark' : 'theme-light'}`} dir="rtl"><div className="flex items-center gap-3 text-slate-600 font-black"><span className="w-3 h-3 rounded-full bg-violet-600 animate-pulse"></span> جاري الاتصال بـ Firebase...</div></div>;
  }

  if (firebaseEnabled && !user) {
    return (
      <div className={`br-app-shell br-login min-h-screen grid lg:grid-cols-[1.05fr_.95fr] ${isDarkMode ? 'theme-dark' : 'theme-light'}`} dir="rtl">
        <div className="br-login-visual hidden lg:flex relative overflow-hidden text-white p-14 flex-col justify-between">
          <div className="absolute inset-0" style={{background:'radial-gradient(circle at 76% 20%, rgba(124,58,237,.52), transparent 27%), radial-gradient(circle at 20% 85%, rgba(59,130,246,.20), transparent 34%)'}}></div>
          <div className="relative z-10"><div className="w-12 h-12 rounded-xl bg-white text-slate-950 flex items-center justify-center font-black">BR</div></div>
          <div className="relative z-10 max-w-xl">
            <p className="text-violet-300 font-black text-xs tracking-[.22em] uppercase mb-5">Telecom Operations</p>
            <h1 className="text-6xl font-black leading-[1.12] tracking-tight">إدارة أوضح.<br/>قرارات أسرع.</h1>
            <p className="text-slate-300 mt-6 leading-8 font-medium">وصول آمن لنظام BR Telecom ومزامنة مباشرة مع قاعدة البيانات السحابية.</p>
          </div>
          <div className="relative z-10 flex items-center gap-2 text-xs text-slate-400 font-bold"><span className="w-2 h-2 bg-emerald-400 rounded-full"></span> Firebase Cloud Connected</div>
        </div>
        <div className="br-login-form-wrap relative flex items-center justify-center p-5 md:p-10">
          <div className="w-full max-w-md"><button type="button" onClick={() => setIsDarkMode(v => !v)} className="br-theme-toggle absolute top-6 left-6 w-11 h-11 rounded-xl border flex items-center justify-center text-lg" title="تغيير المظهر">{isDarkMode ? '☀' : '☾'}</button>
            <div className="lg:hidden w-12 h-12 rounded-xl bg-slate-950 text-white flex items-center justify-center font-black mb-8">BR</div>
            <p className="text-violet-600 font-black text-xs tracking-[.2em] uppercase mb-3">BR Telecom</p>
            <h2 className="text-4xl font-black text-slate-950 tracking-tight">مرحباً بعودتك</h2>
            <p className="text-slate-500 mt-3 mb-9 font-medium">سجل الدخول للوصول إلى لوحة الإدارة.</p>
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-500 mb-2">البريد الإلكتروني</label>
                <input type="email" className={inputClass} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required autoComplete="username" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 mb-2">كلمة المرور</label>
                <input type="password" className={inputClass} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              {loginError && <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-sm font-bold">{loginError}</div>}
              <button disabled={loginLoading} className={`${btnClass} ${loginLoading ? 'opacity-60' : ''}`}>{loginLoading ? 'جاري تسجيل الدخول...' : 'دخول إلى النظام'}</button>
            </form>
            <p className="text-[11px] text-slate-400 font-semibold mt-8">حسابك متصل ببيانات BR Telecom على Firebase.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`br-app-shell min-h-screen text-slate-800 font-sans ${isDarkMode ? 'theme-dark' : 'theme-light'} ${isArabic ? 'dir-rtl' : 'dir-ltr'}`} dir={isArabic ? 'rtl' : 'ltr'}>
      {isSidebarOpen && <button aria-label="إغلاق القائمة" onClick={() => setIsSidebarOpen(false)} className="md:hidden fixed inset-0 bg-slate-950/30 backdrop-blur-[2px] z-30"></button>}

      <header className="br-mobile-header md:hidden fixed top-0 inset-x-0 h-16 backdrop-blur-xl z-40 border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-3"><span className="w-9 h-9 rounded-xl bg-slate-950 text-white flex items-center justify-center text-xs font-black">BR</span><div><p className="font-black text-slate-950 text-sm">BR Telecom</p><p className="text-[10px] text-emerald-600 font-black">Cloud connected</p></div></div>
        <div className="flex items-center gap-2"><button onClick={() => setIsDarkMode(v => !v)} className="br-theme-toggle w-10 h-10 rounded-xl border flex items-center justify-center">{isDarkMode ? '☀' : '☾'}</button><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 font-black">☰</button></div>
      </header>

      <aside className={`fixed inset-y-0 ${isArabic ? 'right-0' : 'left-0'} w-[286px] br-sidebar z-40 transform ${isSidebarOpen ? 'translate-x-0' : isArabic ? 'translate-x-full' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 flex flex-col`}>
        <div className="h-[92px] px-6 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-[14px] bg-slate-950 text-white flex items-center justify-center text-sm font-black shadow-[0_8px_22px_rgba(15,23,42,.16)]">BR</span>
            <div><h1 className="text-lg font-black text-slate-950 leading-tight">BR Telecom</h1><p className="text-[10px] uppercase tracking-[.16em] text-slate-400 font-black mt-1">Management System</p></div>
          </div>
          <button className="md:hidden text-slate-400 text-xl" onClick={() => setIsSidebarOpen(false)}>×</button>
        </div>

        <div className="px-4 pt-5 pb-3"><p className="px-3 text-[10px] uppercase tracking-[.18em] text-slate-400 font-black">Navigation</p></div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar space-y-1">
          {Object.entries(t.menu).map(([key, label]) => {
             if (key === 'activity') return null;
             if (key === 'lang') return (
                <div key={key} className="pt-3 mt-3 border-t border-slate-100">
                  <button onClick={() => setIsArabic(!isArabic)} className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-950 transition-all font-black text-sm"><span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">🌐</span>{label.replace('🌐 ', '')}</button>
                </div>
             );
             const cleanLabel = label.replace(/^[^ ]+\s/, '');
             return (
               <button key={key} onClick={() => { setActiveTab(key); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm ${activeTab === key ? 'bg-slate-950 text-white shadow-[0_8px_20px_rgba(15,23,42,.12)]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>
                 <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-black ${activeTab === key ? 'bg-white/10 text-violet-300' : 'bg-slate-100 text-slate-500'}`}>{menuMeta[key]?.icon || '•'}</span>
                 <span className="font-black flex-1 text-start">{cleanLabel}</span>
                 {activeTab === key && <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>}
               </button>
             );
          })}
        </nav>

        {user && <div className="p-4 border-t border-slate-100">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
            <div className="flex items-center gap-3"><span className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-black">A</span><div className="min-w-0 flex-1"><p className="text-xs text-slate-900 font-black truncate" title={user.email || ''}>{user.email}</p><p className="text-[10px] text-emerald-600 font-black mt-1">{syncStatus || (isCloudLoaded ? 'متصل بالسحابة ✓' : 'جاري التحميل...')}</p></div></div>
            <button onClick={handleLogout} className="mt-3 w-full text-xs font-black text-slate-500 hover:text-rose-600 py-2 rounded-lg hover:bg-white transition-colors">تسجيل الخروج</button>
          </div>
        </div>}
      </aside>

      <main className={`min-h-screen pt-20 md:pt-0 ${isArabic ? 'md:pr-[286px]' : 'md:pl-[286px]'} transition-all`}>
        <div className="br-topbar hidden md:flex h-[92px] px-8 xl:px-10 backdrop-blur-xl border-b items-center justify-between sticky top-0 z-20">
          <div><p className="text-[10px] uppercase tracking-[.18em] text-slate-400 font-black mb-1">BR Telecom / {menuMeta[activeTab]?.hint || 'النظام'}</p><h2 className="text-xl font-black text-slate-950">{(t.menu[activeTab] || '').replace(/^[^ ]+\s/, '') || 'BR Telecom'}</h2></div>
          <div className="flex items-center gap-3">
            <div className="v18-company-switcher">{COMPANY_OPTIONS.map(company=><button key={company.id} type="button" className={`${company.tone} ${activeCompany===company.id?'active':''}`} onClick={()=>switchCompany(company.id)} title={`فتح ${company.name}`}>{company.name}</button>)}</div>
            <div className="v17-global-search"><span>⌕</span><input value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} placeholder="بحث شامل عن عميل أو خط أو باقة..."/>{globalSearch&&<div className="v17-global-results">{globalResults.map(r=><button key={`${r.kind}-${r.id}`} onClick={()=>{if(r.kind==='customer')setSelectedCustomer(r.data);else if(r.kind==='line')setSelectedLine(r.data);else setActiveTab('pkg');setGlobalSearch('')}}><strong>{r.title}</strong><span>{r.sub}</span></button>)}{globalResults.length===0&&<small>لا توجد نتائج</small>}</div>}</div>
            <div className="h-10 px-3.5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-xs text-emerald-700 font-black"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>{syncStatus || 'السحابة متصلة'}</div>
            <button onClick={() => setIsDarkMode(v => !v)} className="br-theme-toggle w-10 h-10 rounded-xl border flex items-center justify-center text-base transition-colors" title="تغيير المظهر">{isDarkMode ? '☀' : '☾'}</button><button onClick={() => setActiveTab('search')} className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-violet-600 hover:border-violet-200 transition-colors">⌕</button>
          </div>
        </div>
        <div className="br-content max-w-[1480px] mx-auto p-4 md:p-8 xl:p-10">
          {activeTab === 'home' && renderHome()}
          {activeTab === 'dash' && renderDashboard()}
          {activeTab === 'lines' && renderLineStructure()}
          {activeTab === 'lines_manage' && renderLinesManage()}
          {activeTab === 'search' && renderSearch()}
          {activeTab === 'arch' && renderArchive()}
          {activeTab === 'collect' && renderCollections()}
          {activeTab === 'reports' && renderReports()}
          {activeTab === 'trash' && renderTrash()}
          {activeTab === 'backup' && renderBackup()}
          {activeTab === 'cust' && renderCustomers()}
          {activeTab === 'res' && renderReservations()}
          {activeTab === 'pkg' && renderPackages()}
          {activeTab === 'extra' && renderExtra()}
          {activeTab === 'exp' && renderExpenses()}
        </div>
      </main>

      {/* v1.7 additive operational overlays */}
      <button className="v17-fab" onClick={()=>setQuickActionsOpen(v=>!v)} aria-label="إجراءات سريعة">+</button>
      {quickActionsOpen&&<div className="v17-quick-menu"><button onClick={()=>{setActiveTab('cust');setQuickActionsOpen(false)}}>+ عميل جديد</button><button onClick={()=>{setActiveTab('res');setQuickActionsOpen(false)}}>+ حجز جديد</button><button onClick={()=>{setActiveTab('extra');setQuickActionsOpen(false)}}>+ باقة إضافية</button><button onClick={()=>{setActiveTab('exp');setQuickActionsOpen(false)}}>+ مصروف</button></div>}
      {selectedCustomer&&<div className="v17-modal-backdrop" onClick={()=>setSelectedCustomer(null)}><div className="v17-detail-modal" onClick={e=>e.stopPropagation()}><div className="v17-drawer-head"><div><h3>كشف حساب العميل</h3><p>{selectedCustomer.id}</p></div><button onClick={()=>setSelectedCustomer(null)}>×</button></div>{(()=>{const p=packages.find(x=>x.id===selectedCustomer.packageId);const l=lines.find(x=>x.id===selectedCustomer.lineId);const extras=extraPackages.filter(x=>x.customerId===selectedCustomer.id);return <><div className="v17-customer-hero"><span>{(selectedCustomer.name||'?').charAt(0)}</span><div><h2>{selectedCustomer.name}</h2><p>{selectedCustomer.phone}</p></div><Status tone={selectedCustomer.payStatus==='Paid'||selectedCustomer.payStatus==='مدفوع'?'success':'danger'}>{selectedCustomer.payStatus}</Status></div><div className="v17-detail-grid"><div><span>الباقة</span><b>{p?.name||'—'}</b></div><div><span>السعر</span><b>{p?.price||0} EGP</b></div><div><span>الخط</span><b>{l?.phone||'—'}</b></div><div><span>الحجز</span><b>{selectedCustomer.isConfirmed===true?'حاجز':'لم يحجز'}</b></div><div><span>الإضافيات</span><b>{extras.length}</b></div><div><span>قيمة الإضافيات</span><b>{extras.reduce((sum,x)=>sum+Number(packages.find(p=>p.id===x.packageId)?.price||0),0)} EGP</b></div></div><div className="v17-detail-actions"><button onClick={()=>{setSelectedCustomer(null);setEditModal({isOpen:true,type:'customer',data:selectedCustomer})}} className="v16-btn v16-btn-primary">تعديل العميل</button></div></>})()}</div></div>}
      {selectedLine&&<div className="v17-modal-backdrop" onClick={()=>setSelectedLine(null)}><div className="v17-detail-modal" onClick={e=>e.stopPropagation()}><div className="v17-drawer-head"><div><h3>تفاصيل الخط</h3><p>{selectedLine.phone}</p></div><button onClick={()=>setSelectedLine(null)}>×</button></div>{(()=>{const lineCust=customers.filter(c=>c.isActive!==false&&getEffectiveLineId(c)===selectedLine.id);const used=lineCust.reduce((sum,c)=>sum+Number(packages.find(p=>p.id===c.packageId)?.gb||0),0)+extraPackages.filter(ex=>(ex.targetLineId||ex.lineId)===selectedLine.id&&ex.isActive!==false).reduce((sum,ex)=>sum+Number(packages.find(p=>p.id===ex.packageId)?.gb||0),0);const avail=Number(selectedLine.baseGB||0)+Number(selectedLine.carriedGB||0);const lineRev=lineCust.reduce((sum,c)=>sum+Number(packages.find(p=>p.id===c.packageId)?.price||0),0)+extraPackages.filter(ex=>(ex.targetLineId||ex.lineId)===selectedLine.id&&ex.isActive!==false).reduce((sum,ex)=>sum+Number(packages.find(p=>p.id===ex.packageId)?.price||0),0)+Number(selectedLine.extraRev||0);const lineNet=lineRev-Number(selectedLine.invoice||0);return <><div className="v17-customer-hero"><span>⌁</span><div><h2>{selectedLine.name}</h2><p>{selectedLine.phone}</p></div><Status tone={lineCust.length>=6?'danger':lineCust.length>=5?'warning':'success'}>{lineCust.length}/6 عملاء</Status></div><div className="v17-detail-grid"><div><span>السعة الكلية</span><b>{avail} GB</b></div><div><span>المستخدم</span><b>{used} GB</b></div><div><span>المتبقي</span><b>{avail-used} GB</b></div><div><span>فاتورة الخط</span><b>{selectedLine.invoice||0} EGP</b></div><div><span>إيراد الخط</span><b>{lineRev} EGP</b></div><div><span>صافي الخط</span><b className={lineNet>=0?'positive':'negative'}>{lineNet} EGP</b></div></div><div className="v17-line-people">{lineCust.map(c=><button key={c.id} onClick={()=>{setSelectedLine(null);setSelectedCustomer(c)}}><span>{c.name}</span><small>{c.phone}</small></button>)}</div></>})()}</div></div>}
      {monthReviewOpen&&<div className="v17-modal-backdrop"><div className="v17-detail-modal"><div className="v17-drawer-head"><div><h3>مراجعة قبل تقفيل الشهر</h3><p>راجع المؤشرات قبل تنفيذ نفس منطق التقفيل الحالي.</p></div><button onClick={()=>setMonthReviewOpen(false)}>×</button></div><div className="v17-review-grid"><div><span>غير المدفوعين</span><b>{unpaidCustomers.length}</b></div><div><span>غير المحصل</span><b>{amountDue.toLocaleString()} EGP</b></div><div><span>حجوزات معلقة</span><b>{reservations.filter(r=>!r.isDistributed).length}</b></div><div><span>الإيرادات</span><b>{totalRev.toLocaleString()} EGP</b></div><div><span>المصروفات</span><b>{totalExp.toLocaleString()} EGP</b></div><div><span>صافي الربح</span><b>{netProfit.toLocaleString()} EGP</b></div></div><div className="v17-detail-actions"><button onClick={()=>setMonthReviewOpen(false)} className="v16-btn v16-btn-soft">إلغاء</button><button onClick={confirmArchiveMonth} className="v16-btn v16-btn-danger">متابعة تقفيل الشهر</button></div></div></div>}

      {/* Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/55 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="br-modal bg-white rounded-[28px] p-7 w-full max-w-sm shadow-[0_28px_90px_rgba(15,23,42,.25)] border border-white/70 transform scale-100 transition-transform">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-5 border border-rose-100">
                {confirmModal.type === 'info' ? 'ℹ️' : '⚠️'}
            </div>
            <h3 className="text-xl font-black mb-2 text-slate-950 text-center">{confirmModal.title}</h3>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed text-center font-medium">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors" onClick={() => setConfirmModal({ isOpen: false, type: '', id: null })}>{t.common.cancel}</button>
              {confirmModal.onConfirm && <button className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all active:scale-95" onClick={confirmModal.onConfirm}>{t.common.confirm}</button>}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/55 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="br-modal bg-white rounded-[28px] p-6 md:p-7 w-full max-w-lg shadow-[0_28px_90px_rgba(15,23,42,.25)] border border-white/70 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-2xl font-black mb-6 text-slate-950 border-b border-slate-100 pb-4">{t.common.edit}</h3>
            <div className="space-y-5">
              {['customer', 'reservation', 'extra'].includes(editModal.type) && (
                <>
                  {editModal.type !== 'extra' && (
                      <>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1.5">{t.common.name}</label><input className={inputClass} value={editModal.data.name} onChange={e=>setEditModal({...editModal, data: {...editModal.data, name: e.target.value}})} /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1.5">{t.common.phone}</label><input className={inputClass} value={editModal.data.phone} onChange={e=>setEditModal({...editModal, data: {...editModal.data, phone: e.target.value}})} /></div>
                      </>
                  )}
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">{t.menu.pkg}</label><select className={inputClass} value={editModal.data.packageId} onChange={e=>setEditModal({...editModal, data: {...editModal.data, packageId: e.target.value}})}><option value="">{t.common.choose}</option>{packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                  
                  {editModal.type === 'customer' && <div><label className="block text-xs font-bold text-slate-500 mb-1.5">الخط</label><select className={inputClass} value={editModal.data.lineId} onChange={e=>setEditModal({...editModal, data: {...editModal.data, lineId: e.target.value}})}><option value="">{t.common.choose}</option>{lines.map(l => <option key={l.id} value={l.id}>{l.name} ({l.phone})</option>)}</select></div>}
                  {editModal.type === 'extra' && <div><label className="block text-xs font-bold text-slate-500 mb-1.5">الخط المحمل عليه</label><select className={inputClass} value={editModal.data.targetLineId} onChange={e=>setEditModal({...editModal, data: {...editModal.data, targetLineId: e.target.value}})}><option value="">نفس خط العميل الأساسي</option>{lines.map(l=><option key={l.id} value={l.id}>{l.name} ({l.phone})</option>)}</select></div>}
                  
                  {editModal.type === 'customer' && (
                      <div><label className="block text-xs font-bold text-slate-500 mb-1.5">حالة الخط (نشط/متوقف)</label><select className={inputClass} value={editModal.data.isActive === false ? 'false' : 'true'} onChange={e=>setEditModal({...editModal, data: {...editModal.data, isActive: e.target.value === 'true'}})}><option value="true">نشط (يعمل ويحسب من العدد)</option><option value="false">متوقف (مغلق ولا يحسب من العدد)</option></select></div>
                  )}

                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">حالة الدفع</label><select className={inputClass} value={editModal.data.payStatus} onChange={e=>setEditModal({...editModal, data: {...editModal.data, payStatus: e.target.value}})}><option value="Unpaid">غير مدفوع (Unpaid)</option><option value="Paid">مدفوع (Paid)</option></select></div>
                  {(editModal.data.payStatus === 'Paid' || editModal.data.payStatus === 'مدفوع') && <div><label className="block text-xs font-bold text-slate-500 mb-1.5">طريقة الدفع</label><select className={inputClass} value={editModal.data.payMethod} onChange={e=>setEditModal({...editModal, data: {...editModal.data, payMethod: e.target.value}})}><option value="">{t.common.choose}</option><option value="InstaPay">إنستاباي (InstaPay)</option><option value="Vodafone Cash">فودافون كاش (Vodafone Cash)</option></select></div>}
                </>
              )}
              {editModal.type === 'package' && (
                <>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">الاسم</label><input className={inputClass} value={editModal.data.name} onChange={e=>setEditModal({...editModal, data: {...editModal.data, name: e.target.value}})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">GB</label><input type="number" className={inputClass} value={editModal.data.gb} onChange={e=>setEditModal({...editModal, data: {...editModal.data, gb: e.target.value}})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">دقائق</label><input type="number" className={inputClass} value={editModal.data.mins || ''} onChange={e=>setEditModal({...editModal, data: {...editModal.data, mins: e.target.value}})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">السعر</label><input type="number" className={inputClass} value={editModal.data.price} onChange={e=>setEditModal({...editModal, data: {...editModal.data, price: e.target.value}})} /></div>
                </>
              )}
              {editModal.type === 'line' && (
                <>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">الاسم</label><input className={inputClass} value={editModal.data.name} onChange={e=>setEditModal({...editModal, data: {...editModal.data, name: e.target.value}})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">{t.common.phone}</label><input className={inputClass} value={editModal.data.phone} onChange={e=>setEditModal({...editModal, data: {...editModal.data, phone: e.target.value}})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">سعة أساسية</label><input type="number" className={inputClass} value={editModal.data.baseGB} onChange={e=>setEditModal({...editModal, data: {...editModal.data, baseGB: e.target.value}})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">مرحل</label><input type="number" className={inputClass} value={editModal.data.carriedGB} onChange={e=>setEditModal({...editModal, data: {...editModal.data, carriedGB: e.target.value}})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">فاتورة</label><input type="number" className={inputClass} value={editModal.data.invoice} onChange={e=>setEditModal({...editModal, data: {...editModal.data, invoice: e.target.value}})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">إيراد إضافي</label><input type="number" className={inputClass} value={editModal.data.extraRev} onChange={e=>setEditModal({...editModal, data: {...editModal.data, extraRev: e.target.value}})} /></div>
                </>
              )}
              {editModal.type === 'expense' && (
                <>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">{t.common.desc}</label><input className={inputClass} value={editModal.data.description} onChange={e=>setEditModal({...editModal, data: {...editModal.data, description: e.target.value}})} /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1.5">{t.common.amount}</label><input type="number" className={inputClass} value={editModal.data.amount} onChange={e=>setEditModal({...editModal, data: {...editModal.data, amount: e.target.value}})} /></div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-8">
              <button className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors" onClick={() => setEditModal({ isOpen: false, type: '', data: null })}>{t.common.cancel}</button>
              <button className="flex-1 bg-violet-600 text-white py-3 rounded-xl font-bold hover:bg-violet-700 shadow-lg shadow-violet-600/20 transition-all active:scale-95" onClick={handleSaveEdit}>{t.common.save}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}