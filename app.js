const defaultProducts=[
{id:1,name:'فرنی تخم خربزه',cat:'فرنی‌ها',desc:'محصول نیمه‌آماده هیلا فود برای آماده‌سازی آسان.',img:'assets/farni-tokhm-kharbeze.jpg'},
{id:2,name:'چاشنی امگا',cat:'سویق‌ها',desc:'چاشنی کاربردی هیلا فود برای استفاده در برنامه غذایی.',img:'assets/chasni-omega.jpg'},
{id:3,name:'کاچی بزرگ',cat:'کاچی‌ها',desc:'کاچی نیمه‌آماده برای آماده‌سازی سریع و ساده.',img:'assets/kachi-bozorg.jpg'},
{id:4,name:'فرنی به و سیب',cat:'فرنی‌ها',desc:'ترکیبی خوش‌طعم برای یک میان‌وعده گرم و دوست‌داشتنی.',img:'assets/farni-beh-sib.png'},
{id:5,name:'پک کودک',cat:'پک کودک',desc:'انتخابی کاربردی برای خانواده و کودک.',img:'assets/products-group.png'},
{id:6,name:'پک قاعدگی',cat:'پک قاعدگی',desc:'یک پک موضوعی از محصولات هیلا فود.',img:'assets/products-group.png'},
{id:7,name:'پک زایمان',cat:'پک زایمان',desc:'محصولات منتخب در قالب یک پک.',img:'assets/products-group.png'},
{id:8,name:'پک اقدام به بارداری',cat:'پک اقدام به بارداری',desc:'پک موضوعی هیلا فود.',img:'assets/products-group.png'},
{id:9,name:'پک رحم و تخمدان',cat:'پک رحم و تخمدان',desc:'پک موضوعی هیلا فود.',img:'assets/products-group.png'},
{id:10,name:'پک سالمندان',cat:'پک سالمندان',desc:'پک موضوعی برای سالمندان.',img:'assets/products-group.png'},
{id:11,name:'پک ضعف',cat:'پک ضعف',desc:'پک موضوعی هیلا فود.',img:'assets/products-group.png'},
{id:12,name:'حریره‌ها',cat:'حریره‌ها',desc:'محصولات گروه حریره‌های هیلا فود.',img:'assets/products-group.png'},
{id:13,name:'سوپ‌ها',cat:'سوپ‌ها',desc:'محصولات گروه سوپ‌های هیلا فود.',img:'assets/products-group.png'},
{id:14,name:'سویق‌ها',cat:'سویق‌ها',desc:'محصولات گروه سویق‌های هیلا فود.',img:'assets/chasni-omega.jpg'}
];
const cats=[['🥣','فرنی‌ها'],['🌰','حریره‌ها'],['🍲','سوپ‌ها'],['🍯','کاچی‌ها'],['🌿','سویق‌ها'],['🧸','پک کودک'],['🌸','پک قاعدگی'],['🤱','پک زایمان'],['🌱','اقدام به بارداری'],['💚','رحم و تخمدان'],['👵','سالمندان'],['✨','ضعف']];
function getProducts(){try{const saved=JSON.parse(localStorage.getItem('hilaProducts')||'null');return Array.isArray(saved)&&saved.length?saved:defaultProducts}catch(e){return defaultProducts}}
function renderCategories(){document.getElementById('categoryGrid').innerHTML=cats.map(c=>`<a class="category" href="#products" onclick="filterProducts('${c[1]}')"><div class="icon">${c[0]}</div><b>${c[1]}</b></a>`).join('')}
function renderProducts(list=getProducts()){document.getElementById('productGrid').innerHTML=list.map(p=>`<article class="product"><div class="photo"><img src="${p.img}" alt="${p.name}" loading="lazy"><span class="badge">هیلا فود</span></div><div class="product-body"><small>${p.cat}</small><h3>${p.name}</h3><p>${p.desc}</p><div class="product-foot"><span class="no-price">قیمت فعلاً اعلام نشده</span><button class="details" onclick="alert('جزئیات ${p.name} در نسخه بعدی تکمیل می‌شود.')">مشاهده</button></div></div></article>`).join('');document.getElementById('resultNote').textContent=list.length+' محصول'}
function filterProducts(q){q=(q||'').trim();const list=getProducts().filter(p=>!q||p.name.includes(q)||p.cat.includes(q)||p.desc.includes(q));renderProducts(list);document.getElementById('products').scrollIntoView({behavior:'smooth',block:'start'})}
function toggleMenu(){document.getElementById('drawer').classList.toggle('open');document.getElementById('shade').classList.toggle('show')}
document.addEventListener('DOMContentLoaded',()=>{renderCategories();renderProducts();});
