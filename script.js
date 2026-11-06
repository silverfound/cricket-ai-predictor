const RAPIDAPI_KEY = "4c9925dbd4msh3c9b1d0ff0489b3p13b539jsn1ef2f7968fc4";
const RAPIDAPI_HOST = "cricket-live-line-advance.p.rapidapi.com";
const BACKEND_URL = "https://cricket-ai-predictor-ciat.onrender.com"; 

let liveMatches = [], upcomingMatches = [], finishedMatches = [], currentTab = 'live';

// ==========================================
// NAME MAPPING (API Name -> Model Name)
// ==========================================
const teamMapping = {
    // Pichli mappings
    "Saint Lucia Kings": "St Lucia Kings",
    "Northern Brave": "Northern Districts",
    "Northern Brave Women": "Northern Districts Women",
    "Central Hinds": "Central Districts Women",
    "Sudurpaschim Royals": "Sudur Paschim Royals",
    
    // Nayi mappings (Jo test mein mili)
    "Antigua & Barbuda Falcons": "Antigua and Barbuda Falcons",
    "St Kitts & Nevis Patriots": "St Kitts and Nevis Patriots",
    "Canterbury Kings": "Canterbury",
    "Auckland Hearts": "Auckland Women",
    "Canterbury Magicians": "Canterbury Women",
    "Otago Sparks": "Otago Women",
    "Wellington Blaze": "Wellington Women"
};

// ==========================================
// ILMI DATA (DICTIONARY & CONSTANTS)
// ==========================================
const abjadValues = {
    'ا': 1, 'ب': 2, 'ج': 3, 'د': 4, 'ہ': 5, 'و': 6, 'ز': 7, 'ح': 8, 'ط': 9,
    'ی': 10, 'ک': 20, 'ل': 30, 'م': 40, 'ن': 50, 'س': 60, 'ع': 70, 'ف': 80, 'ص': 90,
    'ق': 100, 'ر': 200, 'ش': 300, 'ت': 400, 'پ': 2, 'چ': 3, 'ٹ': 400, 'ڈ': 4, 'ڑ': 200, 'ژ': 7, 'گ': 20, 'ے': 10, 'آ': 1, 'ھ': 5, 'ؤ': 6, 'ئ': 10, 'ۃ': 5
};

const urduNumbers = { 0:"صفر",1:"ایک",2:"دو",3:"تین",4:"چار",5:"پانچ",6:"چھ",7:"سات",8:"آٹھ",9:"نو",10:"دس",11:"گیارہ",12:"بارہ",13:"تیرہ",14:"چودہ",15:"پندرہ",16:"سولہ",17:"سترہ",18:"اٹھارہ",19:"انیس",20:"بیس",21:"اکیس",22:"بائیس",23:"تیئیس",24:"چوبیس",25:"پچیس",26:"چھبیس",27:"ستائیس",28:"اٹھائیس",29:"انتیس",30:"تیس",31:"اکتیس",32:"بتیس",33:"تینتیس",34:"چونتیس",35:"پینتیس",36:"چھتیس",37:"سینتیس",38:"اڑتیس",39:"انتالیس",40:"چالیس",41:"اکتالیس",42:"بیالیس",43:"تینتالیس",44:"چوالیس",45:"پینتالیس",46:"چھیالیس",47:"سینتالیس",48:"اڑتالیس",49:"انچاس",50:"پچاس",51:"اکاون",52:"باون",53:"ترپن",54:"چون",55:"پچپن",56:"چھپن",57:"ستاون",58:"اٹھاون",59:"انسٹھ",60:"ساٹھ",61:"اکسٹھ",62:"باسٹھ",63:"تریسٹھ",64:"چونسٹھ",65:"پینسٹھ",66:"چھیاسٹھ",67:"سڑسٹھ",68:"اڑسٹھ",69:"انہتر",70:"ستر",71:"اکہتر",72:"بہتر",73:"تہتر",74:"چوہتر",75:"پچہتر",76:"چھہتر",77:"ستتر",78:"اٹھہتر",79:"اناسی",80:"اسی",81:"اکاسی",82:"بیاسی",83:"تراسی",84:"چوراسی",85:"پچاسی",86:"چھیاسی",87:"ستاسی",88:"اٹھاسی",89:"نواسی",90:"نوے",91:"اکانوے",92:"بانوے",93:"ترانوے",94:"چورانوے",95:"پچانوے",96:"چھیانوے",97:"ستانوے",98:"اٹھانوے",99:"ننانوے",100:"سو" };

const urduMonths = ["محرم", "صفر", "ربیع الاول", "ربیع الثانی", "جمادی الاول", "جمادی الثانی", "رجب", "شعبان", "رمضان", "شوال", "ذیقعد", "ذی الحج"];
const urduDays = { 0: "اتوار", 1: "پیر", 2: "منگل", 3: "بدھ", 4: "جمعرات", 5: "جمعہ", 6: "ہفتہ" };

// --- TEAMS DICTIONARY (Inme aap saari teams add karenge jo aapne list bheji thi) ---
// Main sirf kuch important teams yahan dikha raha hoon, aap apni bheji hui saari lists yahan add kar dein
const urduTeams = {
    // International teams
    "Afghanistan": "افغانستان",
    "Australia": "آسٹریلیا",
    "Bangladesh": "بنگلہ دیش",
    "England": "انگلینڈ",
    "India": "بھارت",
    "Ireland": "آئرلینڈ",
    "New Zealand": "نیوزی لینڈ",
    "Pakistan": "پاکستان",
    "South Africa": "جنوبی افریقہ",
    "Sri Lanka": "سری لنکا",
    "West Indies": "ویسٹ انڈیز",
    "Zimbabwe": "زمبابوے",
    "United Arab Emirates": "متحدہ عرب امارات",
    "UAE": "متحدہ عرب امارات",
    "Oman": "عمان",

    // Teams already referenced in the project
    "Auckland Hearts": "آکلینڈ ہارٹس",
    "Canterbury Magicians": "کینٹربری میجیشنز",
    "Otago Sparks": "اوٹاگو اسپارکس",
    "Wellington Blaze": "ویلنگٹن بلیز",
    "Antigua & Barbuda Falcons": "انٹیگوا اور باربوڈا فالکنز",
    "St Kitts & Nevis Patriots": "سینٹ کٹس اور نیوس پیٹریاٹس",
    "Saint Lucia Kings": "سینٹ لوشیا کنگز",
    "St Lucia Kings": "سینٹ لوشیا کنگز",
    "Northern Brave": "ناردرن بریو",
    "Northern Brave Women": "ناردرن بریو ویمن",
    "Central Hinds": "سینٹرل ہائنڈز",
    "Sudurpaschim Royals": "سُدور پشچم رائلز",
    "Dolphins": "ڈولفنز",
    "Western Province": "ویسٹرن پروونس",
    "Hobart Hurricanes Women": "ہوبارٹ ہریکینز ویمن",
    "Melbourne Renegades Women": "میلبرن رینیگیڈز ویمن",
    "Melbourne Stars Women": "میلبرن اسٹارز ویمن"
};

// --- ADDITIONAL INTERNATIONAL WOMEN + ASSOCIATE + LEAGUE TEAM NAMES ---
Object.assign(urduTeams, {
    "Argentina": "ارجنٹینا", "Austria": "آسٹریا", "Bahrain": "بحرین",
    "Belgium": "بیلجیم", "Bermuda": "برمودا", "Bhutan": "بھوٹان",
    "Botswana": "بوٹسوانا", "Brazil": "برازیل", "Canada": "کینیڈا",
    "Cayman Islands": "کیمین آئی لینڈز", "China": "چین", "Cook Islands": "کک آئی لینڈز",
    "Croatia": "کروشیا", "Czech Republic": "چیک ریپبلک", "Denmark": "ڈنمارک",
    "Estonia": "ایسٹونیا", "Fiji": "فجی", "Finland": "فن لینڈ",
    "France": "فرانس", "Germany": "جرمنی", "Gibraltar": "جبرالٹر",
    "Greece": "یونان", "Guernsey": "گرنزی", "Hong Kong": "ہانگ کانگ",
    "Hungary": "ہنگری", "Indonesia": "انڈونیشیا", "Isle of Man": "آئل آف مین",
    "Italy": "اٹلی", "Japan": "جاپان", "Jersey": "جرسی",
    "Kenya": "کینیا", "Kuwait": "کویت", "Luxembourg": "لکسمبرگ",
    "Malaysia": "ملائیشیا", "Maldives": "مالدیپ", "Malta": "مالٹا",
    "Mexico": "میکسیکو", "Mongolia": "منگولیا", "Mozambique": "موزمبیق",
    "Namibia": "نمیبیا", "Nepal": "نیپال", "Netherlands": "نیدرلینڈز",
    "Nigeria": "نائجیریا", "Norway": "ناروے", "Papua New Guinea": "پاپوا نیو گنی",
    "Philippines": "فلپائن", "Portugal": "پرتگال", "Qatar": "قطر",
    "Romania": "رومانیہ", "Rwanda": "روانڈا", "Saudi Arabia": "سعودی عرب",
    "Scotland": "اسکاٹ لینڈ", "Serbia": "سربیا", "Singapore": "سنگاپور",
    "Spain": "اسپین", "Thailand": "تھائی لینڈ", "Turkey": "ترکی",
    "Uganda": "یوگنڈا", "United States": "امریکہ", "USA": "امریکہ",
    "Vanuatu": "وانواتو", "Zambia": "زیمبیا",

    "Afghanistan Women": "افغانستان ویمن", "Australia Women": "آسٹریلیا ویمن",
    "Bangladesh Women": "بنگلہ دیش ویمن", "England Women": "انگلینڈ ویمن",
    "India Women": "بھارت ویمن", "Ireland Women": "آئرلینڈ ویمن",
    "New Zealand Women": "نیوزی لینڈ ویمن", "Pakistan Women": "پاکستان ویمن",
    "South Africa Women": "جنوبی افریقہ ویمن", "Sri Lanka Women": "سری لنکا ویمن",
    "West Indies Women": "ویسٹ انڈیز ویمن", "Zimbabwe Women": "زمبابوے ویمن",
    "Scotland Women": "اسکاٹ لینڈ ویمن", "Thailand Women": "تھائی لینڈ ویمن",
    "UAE Women": "متحدہ عرب امارات ویمن", "United Arab Emirates Women": "متحدہ عرب امارات ویمن",
    "Netherlands Women": "نیدرلینڈز ویمن", "Nepal Women": "نیپال ویمن",
    "USA Women": "امریکہ ویمن", "United States Women": "امریکہ ویمن",

    "Chennai Super Kings": "چنئی سپر کنگز", "Delhi Capitals": "دہلی کیپیٹلز",
    "Gujarat Titans": "گجرات ٹائٹنز", "Kolkata Knight Riders": "کولکتہ نائٹ رائیڈرز",
    "Lucknow Super Giants": "لکھنؤ سپر جائنٹس", "Mumbai Indians": "ممبئی انڈینز",
    "Punjab Kings": "پنجاب کنگز", "Rajasthan Royals": "راجستھان رائلز",
    "Royal Challengers Bengaluru": "رائل چیلنجرز بنگلورو", "Royal Challengers Bangalore": "رائل چیلنجرز بنگلورو",
    "Sunrisers Hyderabad": "سن رائزرز حیدرآباد",

    "Lahore Qalandars": "لاہور قلندرز", "Karachi Kings": "کراچی کنگز",
    "Islamabad United": "اسلام آباد یونائیٹڈ", "Peshawar Zalmi": "پشاور زلمی",
    "Quetta Gladiators": "کوئٹہ گلیڈی ایٹرز", "Multan Sultans": "ملتان سلطانز",
    "Hyderabad Kingsmen": "حیدرآباد کنگزمین", "Pindiz": "پنڈیز",

    "Durban's Super Giants": "ڈربن سپر جائنٹس", "Joburg Super Kings": "جوبرگ سپر کنگز",
    "MI Cape Town": "ایم آئی کیپ ٹاؤن", "Paarl Royals": "پارل رائلز",
    "Pretoria Capitals": "پریٹوریا کیپیٹلز", "Sunrisers Eastern Cape": "سن رائزرز ایسٹرن کیپ",

    "MI New York": "ایم آئی نیو یارک", "Washington Freedom": "واشنگٹن فریڈم",
    "San Francisco Unicorns": "سان فرانسسکو یونیکورنز", "Texas Super Kings": "ٹیکساس سپر کنگز",
    "Seattle Orcas": "سیٹل اورکاز", "LA Knight Riders": "ایل اے نائٹ رائیڈرز",

    "Hobart Hurricanes": "ہوبارٹ ہریکینز", "Melbourne Renegades": "میلبرن رینیگیڈز",
    "Melbourne Stars": "میلبرن اسٹارز", "Sydney Sixers": "سڈنی سکسرز",
    "Sydney Thunder": "سڈنی تھنڈر", "Perth Scorchers": "پرتھ اسکارچرز",
    "Brisbane Heat": "برسبین ہیٹ", "Adelaide Strikers": "ایڈیلیڈ اسٹرائیکرز",
    "Birmingham Phoenix": "برمنگھم فینکس", "London Spirit": "لندن اسپرٹ",
    "Manchester Super Giants": "مانچسٹر سپر جائنٹس", "MI London": "ایم آئی لندن",
    "Southern Brave": "سدرن بریو", "Sunrisers Leeds": "سن رائزرز لیڈز",
    "Trent Rockets": "ٹرینٹ راکٹس", "Welsh Fire": "ویلش فائر"
});

// Exact match first; then case/spacing/punctuation-insensitive alias match.
function normalizeIlmiName(value) {
    return String(value || "").toLowerCase().replace(/&/g, "and")
        .replace(/[^a-z0-9]/g, "");
}
function getUrduTeamName(value) {
    if (urduTeams[value]) return urduTeams[value];
    const key = Object.keys(urduTeams).find(k => normalizeIlmiName(k) === normalizeIlmiName(value));
    return key ? urduTeams[key] : "";
}

// --- CURRENT INTERNATIONAL / LEAGUE VENUES (API venue name -> Urdu) ---
const urduVenues = {
    "Narendra Modi Stadium": "نریندر مودی اسٹیڈیم",
    "M. A. Chidambaram Stadium": "ایم اے چدمبرم اسٹیڈیم",
    "MA Chidambaram Stadium": "ایم اے چدمبرم اسٹیڈیم",
    "Eden Gardens": "ایڈن گارڈنز",
    "Wankhede Stadium": "وانکھیڑے اسٹیڈیم",
    "Arun Jaitley Stadium": "ارون جیٹلی اسٹیڈیم",
    "Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium": "اِکانا کرکٹ اسٹیڈیم",
    "Ekana Cricket Stadium": "اِکانا کرکٹ اسٹیڈیم",
    "Sawai Mansingh Stadium": "سوائی مان سنگھ اسٹیڈیم",
    "M. Chinnaswamy Stadium": "ایم چناسوامی اسٹیڈیم",
    "M Chinnaswamy Stadium": "ایم چناسوامی اسٹیڈیم",
    "Rajiv Gandhi International Cricket Stadium": "راجیو گاندھی انٹرنیشنل کرکٹ اسٹیڈیم",
    "Himachal Pradesh Cricket Association Stadium": "ہماچل پردیش کرکٹ ایسوسی ایشن اسٹیڈیم",
    "PCA New Cricket Stadium": "پی سی اے نیو کرکٹ اسٹیڈیم",
    "Punjab Cricket Association IS Bindra Stadium": "پی سی اے آئی ایس بندرا اسٹیڈیم",
    "Shaheed Veer Narayan Singh International Cricket Stadium": "شہید ویر نارائن سنگھ اسٹیڈیم",
    "ACA Stadium": "اے سی اے اسٹیڈیم",
    "Barsapara Cricket Stadium": "برساپارا کرکٹ اسٹیڈیم",
    "Hagley Oval": "ہیگلے اوول",
    "Eden Park": "ایڈن پارک",
    "Basin Reserve": "بیسن ریزرو",
    "Bay Oval": "بے اوول",
    "Seddon Park": "سیڈن پارک",
    "Sky Stadium": "اسکائی اسٹیڈیم",
    "Melbourne Cricket Ground": "میلبرن کرکٹ گراؤنڈ",
    "MCG": "میلبرن کرکٹ گراؤنڈ",
    "Sydney Cricket Ground": "سڈنی کرکٹ گراؤنڈ",
    "SCG": "سڈنی کرکٹ گراؤنڈ",
    "Adelaide Oval": "ایڈیلیڈ اوول",
    "Perth Stadium": "پرتھ اسٹیڈیم",
    "Optus Stadium": "آپٹس اسٹیڈیم",
    "The Gabba": "دی گابا",
    "Brisbane Cricket Ground": "برسبین کرکٹ گراؤنڈ",
    "Bellerive Oval": "بیلیریو اوول",
    "Hobart": "ہوبارٹ کرکٹ گراؤنڈ",
    "Manuka Oval": "مانوکا اوول",
    "Carrara Oval": "کارارا اوول",
    "Gaddafi Stadium": "قذافی اسٹیڈیم",
    "National Stadium": "نیشنل اسٹیڈیم کراچی",
    "National Bank Cricket Arena": "نیشنل بینک کرکٹ ایرینا",
    "Rawalpindi Cricket Stadium": "راولپنڈی کرکٹ اسٹیڈیم",
    "Multan Cricket Stadium": "ملتان کرکٹ اسٹیڈیم",
    "Arbab Niaz Stadium": "ارباب نیاز اسٹیڈیم",
    "Bugti Stadium": "بگٹی اسٹیڈیم",
    "Rangiri Dambulla International Stadium": "رنگیری دمبولا انٹرنیشنل اسٹیڈیم",
    "R. Premadasa Stadium": "آر پریماداسا اسٹیڈیم",
    "Pallekele International Cricket Stadium": "پالی کیلے انٹرنیشنل کرکٹ اسٹیڈیم",
    "Galle International Stadium": "گال انٹرنیشنل اسٹیڈیم",
    "Shere Bangla National Stadium": "شیر بنگلہ نیشنل اسٹیڈیم",
    "Zahur Ahmed Chowdhury Stadium": "ظہور احمد چوہدری اسٹیڈیم",
    "Sylhet International Cricket Stadium": "سلہٹ انٹرنیشنل کرکٹ اسٹیڈیم",
    "Dubai International Cricket Stadium": "دبئی انٹرنیشنل کرکٹ اسٹیڈیم",
    "Sharjah Cricket Stadium": "شارجہ کرکٹ اسٹیڈیم",
    "Sheikh Zayed Cricket Stadium": "شیخ زاید کرکٹ اسٹیڈیم",
    "Zayed Cricket Stadium": "زاید کرکٹ اسٹیڈیم",
    "Kensington Oval": "کینسنگٹن اوول",
    "Brian Lara Cricket Academy": "برائن لارا کرکٹ اکیڈمی",
    "Sir Vivian Richards Stadium": "سر ویوین رچرڈز اسٹیڈیم",
    "Providence Stadium": "پروویڈنس اسٹیڈیم",
    "Sabina Park": "سبینا پارک",
    "Queen's Park Oval": "کوئنز پارک اوول",
    "National Cricket Stadium": "نیشنل کرکٹ اسٹیڈیم",
    "Wanderers Stadium": "وانڈررز اسٹیڈیم",
    "Newlands": "نیو لینڈز",
    "Kingsmead": "کنگزمیڈ",
    "SuperSport Park": "سپر اسپورٹ پارک",
    "St George's Park": "سینٹ جارجز پارک",
    "Lord's": "لارڈز",
    "The Oval": "دی اوول",
    "Edgbaston": "ایجبسٹن",
    "Old Trafford": "اولڈ ٹریفورڈ",
    "Headingley": "ہیڈنگلے",
    "Trent Bridge": "ٹرینٹ برج",
    "Rose Bowl": "روز باؤل",
    "Sophia Gardens": "سوفیا گارڈنز",
    "Bristol County Ground": "برسٹل کاؤنٹی گراؤنڈ",
    "County Ground": "کاؤنٹی گراؤنڈ",
    "Riverside Ground": "ریور سائیڈ گراؤنڈ",
    "The Rose Bowl": "روز باؤل",
    "Harare Sports Club": "ہرارے اسپورٹس کلب",
    "Queens Sports Club": "کوئنز اسپورٹس کلب",
    "Kigali": "کیگالی کرکٹ گراؤنڈ",
    "Wanderers Cricket Ground": "وانڈررز کرکٹ گراؤنڈ"
};
function getUrduVenueName(value) {
    if (urduVenues[value]) return urduVenues[value];
    const key = Object.keys(urduVenues).find(k => normalizeIlmiName(k) === normalizeIlmiName(value));
    return key ? urduVenues[key] : "";
}

// --- CAPTAINS DICTIONARY (Urdu spellings for international captains) ---
const urduCaptains = {
    "Rahmat Shah": "رحمت شاہ",
    "Rahmanullah Gurbaz": "رحمٰن اللہ گرباز",
    "Ibrahim Zadran": "ابراہیم زدران",
    "Pat Cummins": "پیٹ کمنز",
    "Mitchell Marsh": "مچل مارش",
    "Najmul Hossain Shanto": "نجمل حسین شانتو",
    "Mehidy Hasan Miraz": "مہدی حسن میراز",
    "Litton Das": "لٹن داس",
    "Tawhid Hridoy": "توحید ہردوئے",
    "Joe Root": "جو روٹ",
    "Harry Brook": "ہیری بروک",
    "Jacob Bethell": "جیکب بیتھل",
    "Shubman Gill": "شبمن گل",
    "Shreyas Iyer": "شریاس ائیر",
    "Andrew Balbirnie": "اینڈریو بالبرنی",
    "Paul Stirling": "پال اسٹرلنگ",
    "Lorcan Tucker": "لورکن ٹکر",
    "Tom Latham": "ٹام لیتھم",
    "Mitchell Santner": "مچل سینٹنر",
    "Babar Azam": "بابر اعظم",
    "Shaheen Afridi": "شاہین آفریدی",
    "Sahibzada Farhan": "صاحبزادہ فرحان",
    "Temba Bavuma": "ٹیمبا باووما",
    "Aiden Markram": "ایڈن مارکرم",
    "Kusal Mendis": "کوشل مینڈس",
    "Dasun Shanaka": "داسن شناکا",
    "Roston Chase": "روسٹن چیز",
    "Shai Hope": "شائی ہوپ",
    "Richard Ngarava": "رچرڈ نگاروا",
    "Sikandar Raza": "سکندر رضا",
    "Vinayak Shukla": "ونائیک شکلا",
    "Muhammad Waseem": "محمد وسیم",
    "Ruturaj Gaikwad": "رتوراج گائیکواڑ",
    "Axar Patel": "اکشر پٹیل",
    "Shubman Gill": "شبمن گل",
    "Ajinkya Rahane": "اجنکیا رہانے",
    "Rishabh Pant": "رشبھ پنت",
    "Hardik Pandya": "ہارڈک پانڈیا",
    "Shreyas Iyer": "شریاس ائیر",
    "Riyan Parag": "ریان پراگ",
    "Rajat Patidar": "رجت پاٹیدار",
    "Ishan Kishan": "ایشان کشن",
    "Shaheen Shah Afridi": "شاہین شاہ آفریدی",
    "Shadab Khan": "شاداب خان",
    "Babar Azam": "بابر اعظم",
    "Mohammad Rizwan": "محمد رضوان",
    "Saud Shakeel": "سعود شکیل",
    "Ashton Turner": "ایشٹن ٹرنر",
    "Marnus Labuschagne": "مارنس لبوشین",
    "David Warner": "ڈیوڈ وارنر",
    "Glenn Maxwell": "گلین میکسویل",
    "Nicholas Pooran": "نکولس پورن",
    "Matt Short": "میٹ شارٹ",
    "Faf du Plessis": "فَف ڈو پلیسی",
    "Sikandar Raza": "سکندر رضا",
    "Jason Holder": "جیسن ہولڈر",
    "Rashid Khan": "راشد خان",
    "David Miller": "ڈیوڈ ملر",
    "Keshav Maharaj": "کیشو مہاراج",
    "Tristan Stubbs": "ٹرسٹن اسٹبس",
    "Sam Curran": "سام کرن",
    "Sam Billings": "سام بلنگز",
    "Phil Salt": "فل سالٹ",
    "Jacob Bethell": "جیکب بیتھل"
};

// --- TEAM TO CAPTAIN MAPPING ---
// Default captain is the T20I captain (or latest documented captain where T20I
// captaincy is not listed). Format-specific values are selected below.
const teamCaptains = {
    "Afghanistan": "Ibrahim Zadran",
    "Australia": "Mitchell Marsh",
    "Bangladesh": "Litton Das",
    "England": "Jacob Bethell",
    "India": "Shreyas Iyer",
    "Ireland": "Lorcan Tucker",
    "New Zealand": "Mitchell Santner",
    "Pakistan": "Sahibzada Farhan",
    "South Africa": "Aiden Markram",
    "Sri Lanka": "Dasun Shanaka",
    "West Indies": "Shai Hope",
    "Zimbabwe": "Sikandar Raza",
    "United Arab Emirates": "Muhammad Waseem",
    "UAE": "Muhammad Waseem",
    "Oman": "Vinayak Shukla",
    "Chennai Super Kings": "Ruturaj Gaikwad",
    "Delhi Capitals": "Axar Patel",
    "Gujarat Titans": "Shubman Gill",
    "Kolkata Knight Riders": "Ajinkya Rahane",
    "Lucknow Super Giants": "Rishabh Pant",
    "Mumbai Indians": "Hardik Pandya",
    "Punjab Kings": "Shreyas Iyer",
    "Rajasthan Royals": "Riyan Parag",
    "Royal Challengers Bengaluru": "Rajat Patidar",
    "Royal Challengers Bangalore": "Rajat Patidar",
    "Sunrisers Hyderabad": "Ishan Kishan",
    "Lahore Qalandars": "Shaheen Shah Afridi",
    "Karachi Kings": "David Warner",
    "Islamabad United": "Shadab Khan",
    "Peshawar Zalmi": "Babar Azam",
    "Quetta Gladiators": "Saud Shakeel",
    "Multan Sultans": "Ashton Turner",
    "Hyderabad Kingsmen": "Marnus Labuschagne",
    "Pindiz": "Mohammad Rizwan",
    "Durban's Super Giants": "Aiden Markram",
    "Joburg Super Kings": "Faf du Plessis",
    "MI Cape Town": "Rashid Khan",
    "Paarl Royals": "David Miller",
    "Pretoria Capitals": "Keshav Maharaj",
    "Sunrisers Eastern Cape": "Tristan Stubbs",
    "MI New York": "Nicholas Pooran",
    "Washington Freedom": "Glenn Maxwell",
    "San Francisco Unicorns": "Matt Short",
    "Texas Super Kings": "Faf du Plessis",
    "Seattle Orcas": "Sikandar Raza",
    "LA Knight Riders": "Jason Holder",
    "Birmingham Phoenix": "Jacob Bethell",
    "MI London": "Sam Curran",
    "Manchester Super Giants": "Aiden Markram",
    "Trent Rockets": "Sam Billings",
    "Welsh Fire": "Phil Salt"
};

// International men's teams: format-wise captains.
// If a format has no separately confirmed captain in the latest available
// captain listing, the most recently documented captain is used as fallback.
const internationalCaptains = {
    "Afghanistan": { "Test": "Rahmat Shah", "ODI": "Rahmat Shah", "T20": "Ibrahim Zadran" },
    "Australia": { "Test": "Pat Cummins", "ODI": "Mitchell Marsh", "T20": "Mitchell Marsh" },
    "Bangladesh": { "Test": "Najmul Hossain Shanto", "ODI": "Litton Das", "T20": "Litton Das" },
    "England": { "Test": "Joe Root", "ODI": "Harry Brook", "T20": "Jacob Bethell" },
    "India": { "Test": "Shubman Gill", "ODI": "Shreyas Iyer", "T20": "Shreyas Iyer" },
    "Ireland": { "Test": "Andrew Balbirnie", "ODI": "Paul Stirling", "T20": "Lorcan Tucker" },
    "New Zealand": { "Test": "Tom Latham", "ODI": "Mitchell Santner", "T20": "Mitchell Santner" },
    "Pakistan": { "Test": "Babar Azam", "ODI": "Shaheen Afridi", "T20": "Sahibzada Farhan" },
    "South Africa": { "Test": "Temba Bavuma", "ODI": "Temba Bavuma", "T20": "Aiden Markram" },
    "Sri Lanka": { "Test": "Kusal Mendis", "ODI": "Dasun Shanaka", "T20": "Dasun Shanaka" },
    "West Indies": { "Test": "Roston Chase", "ODI": "Shai Hope", "T20": "Shai Hope" },
    "Zimbabwe": { "Test": "Richard Ngarava", "ODI": "Sikandar Raza", "T20": "Sikandar Raza" },
    "United Arab Emirates": { "ODI": "Harpreet Singh", "T20": "Muhammad Waseem" },
    "UAE": { "ODI": "Harpreet Singh", "T20": "Muhammad Waseem" },
    "Oman": { "ODI": "Vinayak Shukla", "T20": "Vinayak Shukla" }
};

const friendshipMatrix = {
    1: { friends: [1, 2, 3, 9], enemies: [6, 8] }, 2: { friends: [1, 2, 5], enemies: [4, 8, 9] },
    3: { friends: [1, 2, 3, 9], enemies: [5, 6] }, 4: { friends: [1, 5, 6, 7], enemies: [2, 8, 9] },
    5: { friends: [1, 4, 5, 6], enemies: [] }, 6: { friends: [4, 5, 6, 7], enemies: [1, 2, 3, 9] },
    7: { friends: [4, 6, 7], enemies: [1, 2, 9] }, 8: { friends: [4, 5, 6], enemies: [1, 2, 9] },
    9: { friends: [1, 2, 3, 9], enemies: [4, 6, 8] }
};

// --- ILMI FUNCTIONS ---
function calculateAbjad(word) {
    let total = 0;
    for (let char of word) { if (abjadValues[char]) total += abjadValues[char]; }
    return total;
}

function reduceToSingle(num) {
    while (num > 9) { num = num.toString().split('').reduce((sum, digit) => sum + parseInt(digit), 0); }
    return num;
}

function getMultiplier(teamNum, contextNum) {
    let team = reduceToSingle(teamNum);
    let context = reduceToSingle(contextNum);
    let contextRules = friendshipMatrix[context] || { friends: [], enemies: [] };
    if (contextRules.friends.includes(team)) return 1.15; 
    if (contextRules.enemies.includes(team)) return 0.85; 
    return 1.0;
}

function numberToUrdu(num) {
    if (num <= 100) return urduNumbers[num] || num;
    if (num < 1000) {
        let h = Math.floor(num / 100), r = num % 100;
        return urduNumbers[h] + " سو" + (r > 0 ? " " + (urduNumbers[r] || r) : "");
    }
    let th = Math.floor(num / 1000), h = Math.floor((num % 1000) / 100), r = num % 100;
    return urduNumbers[th] + " ہزار" + (h > 0 ? " " + urduNumbers[h] + " سو" : "") + (r > 0 ? " " + (urduNumbers[r] || r) : "");
}

async function fetchMaghribTime(city, country, dateStr) {
    try {
        let url = `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=4`;
        let res = await fetch(url);
        let data = await res.json();
        if (data.code === 200) {
            return { maghrib: data.data.timings.Maghrib, timezone: data.data.meta.timezone };
        }
    } catch (e) { console.log("Aladhan API error:", e); }
    return { maghrib: "18:00", timezone: "UTC" }; 
}

// ==========================================
// POPUP HTML
// ==========================================
const popupHTML = `
<div id="prediction-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:1000; align-items:center; justify-content:center;">
    <div style="background:#131b2e; padding:20px; border-radius:12px; width:90%; max-width:400px; border:1px solid #00ffcc; max-height: 90vh; overflow-y: auto;">
        <h3 style="color:#00ffcc; margin-top:0;">Match Prediction</h3>
        <p id="modal-match-name" style="color:white; font-weight:bold; font-size: 16px;"></p>
        <p id="modal-venue" style="color:#94a3b8; font-size:12px; margin-top:-10px; margin-bottom:15px;"></p>
        <div id="live-warning" style="display:none; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 8px; border-radius: 6px; margin-bottom: 15px;">
            <p style="color: #ef4444; margin: 0; font-size: 12px; font-weight: bold;">⚠️ Match is Live! This prediction will NOT be saved for accuracy.</p>
        </div>
        
        <div style="background: #0f172a; padding: 10px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #334155;">
            <p style="color: #fbbf24; margin: 0 0 5px 0; font-size: 12px; font-weight: bold;">📊 Pre-Toss Neutral Prediction</p>
            <div id="pre-toss-result" style="color: white; font-size: 14px;">Calculating...</div>
        </div>
        
        <label style="color:#94a3b8; font-size:14px;">Toss Winner:</label>
        <select id="toss-winner" style="width:100%; padding:8px; margin-bottom:10px; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px;"></select>
        <label style="color:#94a3b8; font-size:14px;">Toss Decision:</label>
        <select id="toss-decision" style="width:100%; padding:8px; margin-bottom:15px; background:#0f172a; color:white; border:1px solid #334155; border-radius:6px;">
            <option value="bat">Bat First</option><option value="field">Field First</option>
        </select>
        
        <button id="get-prediction-btn" style="width:100%; padding:10px; background:#00ffcc; color:black; font-weight:bold; border:none; border-radius:6px; cursor:pointer;">Calculate Post-Toss Impact</button>
        
        <div id="post-toss-area" style="display:none; margin-top:15px; padding: 10px; border-radius: 8px; border: 1px solid #00ffcc; background: #0b1120;">
            <p style="color: #00ffcc; margin: 0 0 5px 0; font-size: 12px; font-weight: bold;">🎯 Post-Toss Prediction & Impact</p>
            <div id="prediction-result" style="color:white; text-align:center; font-weight:bold;"></div>
        </div>
        
        <div id="ilmi-area" style="display:none; margin-top:15px; padding: 15px; border-radius: 8px; border: 1px solid #d946ef; background: #1a1525;">
            <h4 style="color:#d946ef; margin: 0 0 5px 0; font-size: 16px;">🔮 Ilmi Insight</h4>
            <span style="font-size: 11px; color: #94a3b8; display: block; margin-bottom: 10px;">Based on Abjad + Compatibility</span>
            <div id="ilmi-content" style="font-size: 13px;"></div>
        </div>
        
        <button onclick="document.getElementById('prediction-modal').style.display='none'" style="width:100%; padding:10px; background:transparent; color:#ff4d4d; border:none; margin-top:15px; cursor:pointer;">Close</button>
    </div>
</div>`;
document.body.insertAdjacentHTML('beforeend', popupHTML);

function wakeUpBackend() { fetch(`${BACKEND_URL}/`).catch(() => {}); }
function getFormattedDate(offset) { let d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().split('T')[0]; }

function savePrediction(matchId, team1, team2, predictedTeam, prob) {
    let history = JSON.parse(localStorage.getItem('ai_prediction_history_v3') || '[]');
    history = history.filter(h => h.matchId !== matchId);
    history.push({ matchId, team1, team2, predictedTeam, probability: prob, date: new Date().toISOString() });
    localStorage.setItem('ai_prediction_history_v3', JSON.stringify(history));
}

function getAccuracyStats() {
    let history = JSON.parse(localStorage.getItem('ai_prediction_history_v3') || '[]');
    let evaluated = history.filter(h => h.isCorrect !== undefined);
    let pending = history.filter(h => h.isCorrect === undefined);
    let correct = evaluated.filter(h => h.isCorrect === true).length;
    return { total: evaluated.length, correct: correct, pending: pending.length };
}

async function fetchMatches(forceRefresh = false) {
    let container = document.getElementById("dynamic-prediction-area");
    let stats = getAccuracyStats();
    let accPercent = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    
    let dashboardHTML = `
        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
            <div style="color: #94a3b8; font-size: 13px;">🤖 <b>AI Accuracy:</b></div>
            <div style="color: #00ffcc; font-weight: bold; font-size: 14px;">
                ${stats.correct} / ${stats.total} Correct (${accPercent}%) 
                <span style="color: #fbbf24; font-size: 11px;">| ${stats.pending} Pending</span>
            </div>
        </div>
    `;

    let tabsHTML = `
        ${dashboardHTML}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 5px;">
                <button id="tab-live" onclick="switchTab('live')" style="padding: 8px 12px; border-radius: 6px; border: none; font-weight: bold; cursor: pointer; background: #00ffcc; color: #000;">🔴 Live</button>
                <button id="tab-upcoming" onclick="switchTab('upcoming')" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #334155; font-weight: bold; cursor: pointer; background: #131b2e; color: white;">⏳ Upcoming</button>
                <button id="tab-finished" onclick="switchTab('finished')" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #334155; font-weight: bold; cursor: pointer; background: #131b2e; color: white;">✅ Finished</button>
            </div>
            <button onclick="fetchMatches(true)" style="background: transparent; color: #00ffcc; border: 1px solid #00ffcc; padding: 8px 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">🔄 Refresh</button>
        </div>
        <div id="matches-container"></div>`;
    
    if (!document.getElementById('tab-live')) { container.innerHTML = tabsHTML; } 
    else {
        let dash = container.querySelector('div[style*="border: 1px solid #334155"]');
        if(dash) dash.outerHTML = dashboardHTML;
    }

    let matchesContainer = document.getElementById("matches-container");
    matchesContainer.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Fetching Latest Data...</h3>`;

    const today = getFormattedDate(0), tomorrow = getFormattedDate(1);
    // Bump cache version so older first-page-only data is not reused.
    const cacheKeyToday = `cricket_data_v26_${today}`;
    const cacheKeyTomorrow = `cricket_data_v26_${tomorrow}`;
    const cacheExpiry = 10 * 60 * 1000;

    let allMatches = [];

    try {
        if (forceRefresh) { localStorage.removeItem(cacheKeyToday); localStorage.removeItem(cacheKeyTomorrow); }

        for (let date of [today, tomorrow]) {
            let cacheKey = date === today ? cacheKeyToday : cacheKeyTomorrow;
            let cachedData = localStorage.getItem(cacheKey);
            let fetchNeeded = true;

            if (cachedData && !forceRefresh) {
                let parsed = JSON.parse(cachedData);
                if (Date.now() - parsed.time < cacheExpiry && parsed.data.length > 0) { allMatches.push(...parsed.data); fetchNeeded = false; }
            }

            if (fetchNeeded) {
                // This API uses "paged" (not "page" or "offset") and reports total_pages.
                const fetchDatePage = async (page) => {
                    const params = new URLSearchParams({
                        date,
                        per_paged: "10",
                        paged: String(page),
                        _nocache: String(Date.now())
                    });
                    const res = await fetch(`https://${RAPIDAPI_HOST}/matches?${params.toString()}`, {
                        headers: { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": RAPIDAPI_HOST },
                        cache: "no-store"
                    });
                    if (!res.ok) throw new Error(`Matches API failed for ${date}, page ${page}: HTTP ${res.status}`);
                    return await res.json();
                };

                const firstPageData = await fetchDatePage(1);
                const firstResponse = firstPageData.response || {};
                const dateItems = [...(firstResponse.items || [])];
                const totalPages = Math.max(1, Number(firstResponse.total_pages) || 1);

                for (let page = 2; page <= totalPages; page++) {
                    const pageData = await fetchDatePage(page);
                    const pageItems = pageData.response?.items || [];
                    dateItems.push(...pageItems);
                }

                if (dateItems.length > 0) {
                    allMatches.push(...dateItems);
                    localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data: dateItems }));
                }
            }
        }

        liveMatches = []; upcomingMatches = []; finishedMatches = [];
        let seen = new Set();

        allMatches.forEach(m => {
            if (!m.teama || !m.teamb) return;
            let fmt = (m.format_str || '').toLowerCase(), isDom = m.domestic === "1";
            const competitionText = [
                m.competition?.title, m.competition?.name, m.competition?.abbr,
                m.competition_name, m.league?.name, m.league?.title,
                m.tournament?.name, m.tournament?.title, m.title
            ].filter(Boolean).join(' ').toLowerCase();

            // Hide all T10 fixtures and Ford Trophy fixtures from match lists.
            if (fmt.includes('t10') || fmt.includes('10 overs')) return;
            if (competitionText.includes('ford trophy')) return;
            if (fmt.includes('first class') && isDom) return;
            if (fmt.includes('odi') && isDom) return;

            if (seen.has(m.timestamp_start + m.teama.name + m.teamb.name)) return;
            seen.add(m.timestamp_start + m.teama.name + m.teamb.name);

            let status = (m.status_str || '').toLowerCase();
            if (status.includes('completed') || status.includes('finish') || status.includes('result') || status.includes('won') || status.includes('draw') || status.includes('abandon')) { finishedMatches.push(m); }
            else if (status.includes('live') || status.includes('progress') || status.includes('break') || status.includes('stumps') || status.includes('innings')) { liveMatches.push(m); }
            else { upcomingMatches.push(m); }
        });

        upcomingMatches.sort((a,b) => a.timestamp_start - b.timestamp_start);
        finishedMatches.sort((a,b) => b.timestamp_start - a.timestamp_start);
        switchTab(liveMatches.length > 0 ? 'live' : 'upcoming');
        
    } catch (e) { matchesContainer.innerHTML = `<div style="color:red; text-align:center;">Error: ${e.message}</div>`; }
}

function switchTab(tab) {
    currentTab = tab;
    ['live','upcoming','finished'].forEach(t => {
        let el = document.getElementById('tab-'+t);
        if(!el) return;
        el.style.background = t === tab ? '#00ffcc' : '#131b2e';
        el.style.color = t === tab ? '#000' : 'white';
        el.style.border = t === tab ? 'none' : '1px solid #334155';
    });
    let matchesToRender = [];
    if (tab === 'live') matchesToRender = liveMatches;
    if (tab === 'upcoming') matchesToRender = upcomingMatches;
    if (tab === 'finished') matchesToRender = finishedMatches;
    renderMatches(matchesToRender);
}

function renderMatches(matches) {
    let container = document.getElementById("matches-container");
    if (!matches.length) {
        container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding: 20px;">Is category mein filhal koi match nahi hai. Refresh dabayein.</div>`;
        return;
    }
    let html = "";
    let history = JSON.parse(localStorage.getItem('ai_prediction_history_v3') || '[]');
    
    matches.forEach((m, index) => {
        let fmt = m.format_str || "T20";
        let matchType = "T20";
        if (fmt.toLowerCase().includes("test") || fmt.toLowerCase().includes("first class")) matchType = "Test";
        else if (fmt.toLowerCase().includes("odi") || fmt.toLowerCase().includes("list a")) matchType = "ODI";

        let time = new Date(m.timestamp_start * 1000).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        let statusText = currentTab === 'live' ? `<p style="color: #ff4d4d; margin: 0 0 5px 0; font-size: 0.85rem; font-weight: bold;">🔴 LIVE</p>` : '';
        
        if (currentTab === 'finished' && m.status_note) {
            let note = m.status_note;
            statusText = `<p style="color: #00ffcc; margin: 0 0 5px 0; font-size: 0.85rem; font-weight: bold;">${note}</p>`;
            let savedPred = history.find(h => h.matchId === m.match_id);
            if (savedPred) {
                let predictedTeam = savedPred.predictedTeam;
                let isCorrect = note.toLowerCase().includes(predictedTeam.toLowerCase()) && note.toLowerCase().includes("won");
                if (note.toLowerCase().includes("draw") || note.toLowerCase().includes("tie") || note.toLowerCase().includes("abandon")) isCorrect = false; 
                let badgeColor = isCorrect ? '#22c55e' : '#ef4444';
                let badgeText = isCorrect ? '✅ Prediction Correct' : '❌ Prediction Wrong';
                statusText += `
                    <div style="margin-top: 8px; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; border: 1px dashed ${badgeColor};">
                        <p style="color: #cbd5e1; margin: 0 0 4px 0; font-size: 0.75rem;">AI predicted: <b>${predictedTeam}</b></p>
                        <p style="color: ${badgeColor}; margin: 0; font-size: 0.8rem; font-weight: bold;">${badgeText}</p>
                    </div>`;
                if (savedPred.isCorrect === undefined) { savedPred.isCorrect = isCorrect; localStorage.setItem('ai_prediction_history_v3', JSON.stringify(history)); }
            } else { statusText += `<p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 0.75rem; font-style: italic;">AI prediction not recorded.</p>`; }
        }

        html += `
            <div style="background: #131b2e; padding: 15px; margin: 10px 0; border-radius: 12px; border: 1px solid rgba(0,255,204,0.2);">
                <p style="color: #00ffcc; font-size: 0.8rem; margin: 0 0 5px 0;">${m.competition?.title.toUpperCase() || 'MATCH'} | ${matchType}</p>
                <h4 style="color: #fff; margin: 0 0 5px 0;">${m.teama.name} vs ${m.teamb.name}</h4>
                <p style="color: #cbd5e1; font-size: 0.85rem; margin: 0 0 5px 0;">🏟️ ${m.venue?.name || 'Unknown'}</p>
                ${statusText}
                <p style="color: #fbbf24; font-size: 0.85rem; margin: 0 0 10px 0;">📅 ${time}</p>
                ${currentTab !== 'finished' ? `<button class="predict-btn" data-index="${index}" style="width: 100%; padding: 8px; background: #00ffcc; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">🔮 Predict Winner</button>` : ''}
            </div>`;
    });
    container.innerHTML = html;

    let buttons = container.querySelectorAll('.predict-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', function() {
            let idx = parseInt(this.getAttribute('data-index'));
            let match = matches[idx];
            if (match) {
                let fmt = match.format_str || "T20";
                let matchType = "T20";
                if (fmt.toLowerCase().includes("test") || fmt.toLowerCase().includes("first class")) matchType = "Test";
                else if (fmt.toLowerCase().includes("odi") || fmt.toLowerCase().includes("list a")) matchType = "ODI";
                
                let t1 = match.teama ? match.teama.name : '';
                let t2 = match.teamb ? match.teamb.name : '';
                let v = match.venue && match.venue.name ? match.venue.name : '';
                let safeVenue = v.replace(/'/g, ""); 
                let matchId = match.match_id ? match.match_id : match.timestamp_start;
                
                let city = match.venue?.location || "Unknown";
                let country = match.venue?.country || "Unknown";

                openPredictModal(t1, t2, safeVenue, matchType, matchId, match.timestamp_start, currentTab === 'live', city, country);
            }
        });
    });
}

// ==========================================
// MAIN PREDICTION MODAL LOGIC
// ==========================================
async function openPredictModal(t1, t2, venue, type, matchId, startTime, isLiveMatch, city, country) {
    document.getElementById('prediction-modal').style.display = 'flex';
    document.getElementById('modal-match-name').innerText = `${t1} vs ${t2} (${type})`;
    document.getElementById('modal-venue').innerText = `🏟️ ${venue}`;
    document.getElementById('post-toss-area').style.display = 'none';
    document.getElementById('ilmi-area').style.display = 'none'; 
    document.getElementById('toss-winner').innerHTML = `<option value="${t1}">${t1}</option><option value="${t2}">${t2}</option>`;

    if (isLiveMatch) { document.getElementById('live-warning').style.display = 'block'; } 
    else { document.getElementById('live-warning').style.display = 'none'; }

    // --- NAME MAPPING FOR AI ---
    let modelT1 = teamMapping[t1] || t1;
    let modelT2 = teamMapping[t2] || t2;

    // 1. AI PRE-TOSS CALCULATION
    let preDiv = document.getElementById('pre-toss-result');
    preDiv.innerText = "Calculating Neutral Baseline...";
    window.prePred = null;

    try {
        const res = await fetch(`${BACKEND_URL}/predict`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ match_type: type, team1: modelT1, team2: modelT2, venue })
        });
        const pred = await res.json();
        
        if (pred.success) {
            window.prePred = pred.predictions; 
            preDiv.innerHTML = `<div style="display:flex; justify-content:space-between;"><span style="color:#00ffcc;">${t1}: <b>${pred.predictions[modelT1]}</b></span><span style="color:#ff4d4d;">${t2}: <b>${pred.predictions[modelT2]}</b></span></div>`;
            
            if (pred.is_default && (t1 === "Afghanistan" || t2 === "Afghanistan")) {
                preDiv.innerHTML += `<p style="color: #fbbf24; font-size: 10px; margin-top: 5px;">⚠️ Afghanistan ka AI data missing hai. Fallback use ho raha hai.</p>`;
            }

            if (!isLiveMatch) {
                let p1 = parseFloat(pred.predictions[modelT1]), p2 = parseFloat(pred.predictions[modelT2]);
                let winner = p1 > p2 ? t1 : t2;
                savePrediction(matchId, t1, t2, winner, Math.max(p1, p2));
            }
        }
    } catch (e) { preDiv.innerText = "Error loading prediction."; }

    // 2. ILMI CALCULATION
    document.getElementById('ilmi-area').style.display = 'block';
    let ilmiDiv = document.getElementById('ilmi-content');
    ilmiDiv.innerHTML = "Calculating Ilmi Insight...";

    let d = new Date(startTime * 1000);
    let dayStr = String(d.getDate()).padStart(2, '0');
    let monthStr = String(d.getMonth() + 1).padStart(2, '0');
    let yearStr = d.getFullYear();
    let apiDate = `${dayStr}-${monthStr}-${yearStr}`;

    let apiData = await fetchMaghribTime(city, country, apiDate);
    let maghribTime = apiData.maghrib;
    let venueTimezone = apiData.timezone || "UTC";

    let matchTimeStr = d.toLocaleTimeString('en-US', { timeZone: venueTimezone, hour12: false, hour: '2-digit', minute: '2-digit' });
    let dateObj = new Date(startTime * 1000);
    if (matchTimeStr >= maghribTime) { dateObj.setDate(dateObj.getDate() + 1); }

    let finalGregorianDate = dateObj.toLocaleDateString('en-CA', { timeZone: venueTimezone }); 
    let hijriDateStr = "";
    try {
        let gToHRes = await fetch(`https://api.aladhan.com/v1/gToH/${finalGregorianDate}`);
        let gToHData = await gToHRes.json();
        if (gToHData.code === 200) {
            let hDate = gToHData.data.hijri;
            hijriDateStr = `${numberToUrdu(parseInt(hDate.day))} ${urduMonths[hDate.month.number - 1]} ${numberToUrdu(parseInt(hDate.year))}`;
        }
    } catch (e) { console.log("gToH API Error:", e); }

    if (!hijriDateStr) {
        let formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', { day: 'numeric', month: 'numeric', year: 'numeric' });
        let parts = formatter.formatToParts(dateObj);
        hijriDateStr = `${numberToUrdu(parseInt(parts.find(p => p.type === 'day').value))} ${urduMonths[parseInt(parts.find(p => p.type === 'month').value) - 1]} ${numberToUrdu(parseInt(parts.find(p => p.type === 'year').value.replace(' AH', '').replace(' BC', '')))}`;
    }

    // Parse the venue-local calendar date at UTC noon to avoid browser timezone day-shifts.
    const [localYear, localMonth, localDay] = finalGregorianDate.split("-").map(Number);
    let dayUrdu = urduDays[new Date(Date.UTC(localYear, localMonth - 1, localDay, 12)).getUTCDay()];

    let urduT1 = getUrduTeamName(t1);
    let urduT2 = getUrduTeamName(t2);
    let urduVenue = getUrduVenueName(venue);

    // Never silently calculate Abjad with "unknown" placeholder text.
    const missingIlmiNames = [];
    if (!urduT1) missingIlmiNames.push(t1);
    if (!urduT2) missingIlmiNames.push(t2);
    if (!urduVenue) missingIlmiNames.push(venue || "Venue");
    if (missingIlmiNames.length) {
        ilmiDiv.innerHTML = `<div style="color:#fbbf24;">Ilmi mapping abhi available nahi: ${missingIlmiNames.join(", ")}. Is naam ki Urdu mapping add karni hogi; AI prediction par iska koi asar nahi.</div>`;
    } else {
    
    // --- CAPTAIN LOGIC (Format-wise for International) ---
    let capT1_Name = "";
    let capT2_Name = "";

    if (internationalCaptains[t1]) {
        capT1_Name = internationalCaptains[t1][type] || internationalCaptains[t1]["T20"] || "";
    } else {
        capT1_Name = teamCaptains[t1] || "";
    }

    if (internationalCaptains[t2]) {
        capT2_Name = internationalCaptains[t2][type] || internationalCaptains[t2]["T20"] || "";
    } else {
        capT2_Name = teamCaptains[t2] || "";
    }

    let urduCap1 = urduCaptains[capT1_Name] || "";
    let urduCap2 = urduCaptains[capT2_Name] || "";

    let baseA = calculateAbjad(urduT1) + calculateAbjad(urduCap1); 
    let baseB = calculateAbjad(urduT2) + calculateAbjad(urduCap2); 
    let contextAdad = calculateAbjad(urduVenue) + calculateAbjad(hijriDateStr) + calculateAbjad(dayUrdu);
    
    let timeDigits = matchTimeStr.replace(':', '');
    let timeAdad = reduceToSingle(parseInt(timeDigits)); 

    let contextMultA = getMultiplier(baseA, contextAdad);
    let contextMultB = getMultiplier(baseB, contextAdad);
    let timeMultA = getMultiplier(baseA, timeAdad);
    let timeMultB = getMultiplier(baseB, timeAdad);

    let finalA = baseA * contextMultA * timeMultA;
    let finalB = baseB * contextMultB * timeMultB;
    let winnerText = finalA > finalB ? t1 : (finalB > finalA ? t2 : "Tie");

    let ilmiHtml = `
        <div style="margin-bottom: 10px; font-size: 12px; color: #cbd5e1;">
            📅 <span class="urdu-text">${hijriDateStr}</span> | 🗓️ <span class="urdu-text">${dayUrdu}</span>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 5px;">(Ground Time: ${matchTimeStr} | Maghrib: ${maghribTime})</div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
                <td style="color:#00ffcc; padding: 4px 0;">${t1} <br><span style="font-size:10px;color:#94a3b8;">(${capT1_Name || 'Unknown'})</span></td>
                <td style="text-align:right; font-weight:bold; color:#00ffcc;">${finalA.toFixed(1)}</td>
            </tr>
            <tr>
                <td style="color:#ef4444; padding: 4px 0;">${t2} <br><span style="font-size:10px;color:#94a3b8;">(${capT2_Name || 'Unknown'})</span></td>
                <td style="text-align:right; font-weight:bold; color:#ef4444;">${finalB.toFixed(1)}</td>
            </tr>
        </table>
        <div style="text-align: center; margin-top: 10px; color: #d946ef; font-weight: bold; font-size: 14px;">
            🌟 ${winnerText} Ka Pala Bhari Hai!
        </div>
    `;
    ilmiDiv.innerHTML = ilmiHtml;
    }

    // 3. POST-TOSS AI CALCULATION
    document.getElementById('get-prediction-btn').onclick = async () => {
        const tw = document.getElementById('toss-winner').value;
        const td = document.getElementById('toss-decision').value;
        let postDiv = document.getElementById('prediction-result');
        
        document.getElementById('post-toss-area').style.display = 'block';
        postDiv.innerHTML = "Calculating Post-Toss Impact...";

        let modelTw = teamMapping[tw] || tw;

        try {
            const res = await fetch(`${BACKEND_URL}/predict`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ match_type: type, team1: modelT1, team2: modelT2, venue, toss_winner: modelTw, toss_decision: td })
            });
            const pred = await res.json();
            if (pred.success) {
                const p1 = pred.predictions[modelT1], p2 = pred.predictions[modelT2];
                let html = `<div style="display:flex; justify-content:space-between; margin-bottom:10px;"><span style="color:#00ffcc;">${t1}: <b>${p1}</b></span><span style="color:#ff4d4d;">${t2}: <b>${p2}</b></span></div>`;
                
                if (!isLiveMatch) {
                    let n1 = parseFloat(p1), n2 = parseFloat(p2);
                    savePrediction(matchId, t1, t2, (n1 > n2 ? t1 : t2), Math.max(n1, n2));
                }

                if (window.prePred) {
                    const preP1 = window.prePred[modelT1];
                    const preP2 = window.prePred[modelT2];
                    const d1 = (parseFloat(p1) - parseFloat(preP1)).toFixed(1);
                    const d2 = (parseFloat(p2) - parseFloat(preP2)).toFixed(1);
                    html += `<div style="font-size:12px; border-top:1px solid #334155; padding-top:10px;">Toss Impact:</div>
                             <div style="display:flex; justify-content:space-between; font-size:12px;">
                                <span style="color:${d1>0?'#22c55e':(d1<0?'#ef4444':'#94a3b8')}">${t1} (${d1>0?'+':''}${d1}%)</span>
                                <span style="color:${d2>0?'#22c55e':(d2<0?'#ef4444':'#94a3b8')}">${t2} (${d2>0?'+':''}${d2}%)</span>
                             </div>`;
                }
                postDiv.innerHTML = html;
            }
        } catch (e) { postDiv.innerText = "Error calculating impact."; }
    };
}

document.addEventListener("DOMContentLoaded", () => { wakeUpBackend(); fetchMatches(); });
