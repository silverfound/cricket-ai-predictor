
let liveMatches = [], upcomingMatches = [], finishedMatches = [], currentTab = 'live';
let allowedPredictionMatchIds = new Set();

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

    "Biratnagar Kings": "بیرات نگر کنگز",
    "Chitwan Rhinos": "چتوان رائنو ز",
    "Janakpur Bolts": "جنک پور بولٹس",
    "Karnali Yaks": "کرنالی یاکس",
    "Kathmandu Gorkhas": "کھٹمنڈو گورکھاز",
    "Kathmandu Gurkhas": "کھٹمنڈو گورکھاز",
    "Lumbini Lions": "لمبنی لائنز",
    "Pokhara Avengers": "پوکھرا ایونجرز",
    "Sudurpaschim Royals": "سدورپشچم رائلز",
    "Karnali Yaks": "کرنالی یاکس",

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
    "Trent Rockets": "ٹرینٹ راکٹس", "Welsh Fire": "ویلش فائر",
    "Adelaide Strikers Women": "ایڈیلیڈ اسٹرائیکرز ویمن",
    "Brisbane Heat Women": "برسبین ہیٹ ویمن",
    "Sydney Sixers Women": "سڈنی سکسرز ویمن",
    "Sydney Thunder Women": "سڈنی تھنڈر ویمن",
    "Perth Scorchers Women": "پرتھ اسکارچرز ویمن",
    "Hobart Hurricanes Women": "ہوبارٹ ہریکینز ویمن",
    "Melbourne Stars Women": "میلبرن اسٹارز ویمن",
    "Melbourne Renegades Women": "میلبرن رینیگیڈز ویمن",
    "Queensland": "کوئنز لینڈ", "New South Wales": "نیو ساؤتھ ویلز",
    "Victoria": "وکٹوریا", "Western Australia": "ویسٹرن آسٹریلیا",
    "South Australia": "ساؤتھ آسٹریلیا", "Tasmania": "تسمانیہ",
    "Northern Districts": "ناردرن ڈسٹرکٹس", "Central Districts": "سینٹرل ڈسٹرکٹس",
    "Auckland": "آکلینڈ", "Canterbury": "کینٹربری", "Otago": "اوٹاگو", "Wellington": "ویلنگٹن"
});

// Current Abu Dhabi T10 2026 franchise names (official tournament roster).
Object.assign(urduTeams, {
    "UAE Bulls": "یو اے ای بلز",
    "Yas Lions": "یاس لائنز",
    "Royal Desert Champions": "رائل ڈیزرٹ چیمپئنز",
    "Emirates Eagles": "امارات ایگلز",
    "United Tigers": "یونائیٹڈ ٹائیگرز",
    "Arabian Aces": "عربین ایسز",
    "Trinbago Knight Riders": "ٹرینیباگو نائٹ رائیڈرز",
    "Guyana Amazon Warriors": "گیانا ایمازون وارئیرز",
    "Barbados Tridents": "بارباڈوس ٹرائیڈنٹس",
    "Jamaica Kingsmen": "جمیکا کنگز مین",
    "Rajshahi Warriors": "راجشاہی وارئیرز",
    "Chattogram Royals": "چٹگرام رائلز",
    "Sylhet Titans": "سلہٹ ٹائٹنز",
    "Rangpur Riders": "رنگپور رائیڈرز",
    "Dhaka Capitals": "ڈھاکہ کیپیٹلز",
    "Noakhali Express": "نوکھالی ایکسپریس",
    "Akcel United Kabul": "اکسل یونائیٹڈ کابل",
    "Balkh Zwanan": "بلخ جوانان",
    "Kandahar Warriors": "قندھار وارئیرز",
    "Nangarhar Cosmic": "ننگرہار کاسمک",
    "Paktia": "پکتیا"
});

// Domestic provincial/county sides are intentionally excluded from Ilmi mappings.
[
    "Auckland Hearts","Canterbury Magicians","Otago Sparks","Wellington Blaze",
    "Northern Brave","Northern Brave Women","Central Hinds","Dolphins","Western Province",
    "Queensland","New South Wales","Victoria","Western Australia","South Australia","Tasmania",
    "Northern Districts","Central Districts","Auckland","Canterbury","Otago","Wellington"
].forEach(name => delete urduTeams[name]);

// Explicit Urdu spellings for all 112 international sides in the Cricsheet training subset.
Object.assign(urduTeams, {
    "Afghanistan": "افغانستان",
    "Africa XI": "افریقہ الیون",
    "Argentina": "ارجنٹائن",
    "Asia XI": "ایشیا الیون",
    "Australia": "آسٹریلیا",
    "Austria": "آسٹریا",
    "Bahamas": "بہاماس",
    "Bahrain": "بحرین",
    "Bangladesh": "بنگلہ دیش",
    "Barbados": "بارباڈوس",
    "Belgium": "بیلجیم",
    "Belize": "بیلیز",
    "Bermuda": "برمودا",
    "Bhutan": "بھوٹان",
    "Botswana": "بوٹسوانا",
    "Brazil": "برازیل",
    "Bulgaria": "بلغاریہ",
    "Cambodia": "کمبوڈیا",
    "Cameroon": "کیمرون",
    "Canada": "کینیڈا",
    "Cayman Islands": "کیمین آئی لینڈز",
    "Chile": "چلی",
    "China": "چین",
    "Cook Islands": "کک آئی لینڈز",
    "Costa Rica": "کوسٹا ریکا",
    "Croatia": "کروشیا",
    "Cyprus": "قبرص",
    "Czech Republic": "جمہوریہ چیک",
    "Denmark": "ڈنمارک",
    "England": "انگلینڈ",
    "Estonia": "ایسٹونیا",
    "Eswatini": "ایسواتینی",
    "Fiji": "فجی",
    "Finland": "فن لینڈ",
    "France": "فرانس",
    "Gambia": "گیمبیا",
    "Germany": "جرمنی",
    "Ghana": "گھانا",
    "Gibraltar": "جبرالٹر",
    "Greece": "یونان",
    "Guernsey": "گرنزی",
    "Hong Kong": "ہانگ کانگ",
    "Hungary": "ہنگری",
    "ICC World XI": "آئی سی سی ورلڈ الیون",
    "India": "بھارت",
    "Indonesia": "انڈونیشیا",
    "Iran": "ایران",
    "Ireland": "آئرلینڈ",
    "Isle of Man": "آئل آف مین",
    "Israel": "اسرائیل",
    "Italy": "اٹلی",
    "Ivory Coast": "آئیوری کوسٹ",
    "Japan": "جاپان",
    "Jersey": "جرسی",
    "Kenya": "کینیا",
    "Kuwait": "کویت",
    "Lesotho": "لیسوتھو",
    "Luxembourg": "لکسمبرگ",
    "Malawi": "ملاوی",
    "Malaysia": "ملائیشیا",
    "Maldives": "مالدیپ",
    "Mali": "مالی",
    "Malta": "مالٹا",
    "Mexico": "میکسیکو",
    "Mongolia": "منگولیا",
    "Mozambique": "موزمبیق",
    "Myanmar": "میانمار",
    "Namibia": "نمیبیا",
    "Nepal": "نیپال",
    "Netherlands": "نیدرلینڈز",
    "New Zealand": "نیوزی لینڈ",
    "Nigeria": "نائجیریا",
    "Norway": "ناروے",
    "Oman": "عمان",
    "Pakistan": "پاکستان",
    "Panama": "پاناما",
    "Papua New Guinea": "پاپوا نیو گنی",
    "Peru": "پیرو",
    "Philippines": "فلپائن",
    "Portugal": "پرتگال",
    "Qatar": "قطر",
    "Romania": "رومانیہ",
    "Rwanda": "روانڈا",
    "Samoa": "ساموا",
    "Saudi Arabia": "سعودی عرب",
    "Scotland": "اسکاٹ لینڈ",
    "Serbia": "سربیا",
    "Seychelles": "سیشلز",
    "Sierra Leone": "سیرا لیون",
    "Singapore": "سنگاپور",
    "Slovenia": "سلووینیا",
    "South Africa": "جنوبی افریقہ",
    "South Korea": "جنوبی کوریا",
    "Spain": "اسپین",
    "Sri Lanka": "سری لنکا",
    "St Helena": "سینٹ ہیلینا",
    "Suriname": "سورینام",
    "Swaziland": "سوازی لینڈ",
    "Sweden": "سویڈن",
    "Switzerland": "سوئٹزرلینڈ",
    "Tanzania": "تنزانیہ",
    "Thailand": "تھائی لینڈ",
    "Timor-Leste": "تیمور لیستے",
    "Turkey": "ترکی",
    "Turks and Caicos Island": "ٹرکس اینڈ کیکوس آئی لینڈ",
    "Uganda": "یوگنڈا",
    "United Arab Emirates": "متحدہ عرب امارات",
    "United States of America": "ریاستہائے متحدہ امریکہ",
    "Uzbekistan": "ازبکستان",
    "Vanuatu": "وانواتو",
    "West Indies": "ویسٹ انڈیز",
    "Zambia": "زیمبیا",
    "Zimbabwe": "زمبابوے"
});

// Exact match first; then case/spacing/punctuation-insensitive alias match.
function normalizeIlmiName(value) {
    return String(value || "").toLowerCase().replace(/&/g, "and")
        .replace(/[^a-z0-9]/g, "");
}
// Dataset-wide Urdu fallback for every Cricsheet international/major-league name.
const ilmiWordUrdu = {
    "the":"دی","and":"اور","of":"آف","international":"انٹرنیشنل","national":"نیشنل",
    "cricket":"کرکٹ","stadium":"اسٹیڈیم","ground":"گراؤنڈ","oval":"اوول","park":"پارک",
    "field":"فیلڈ","centre":"سینٹر","center":"سینٹر","sports":"اسپورٹس","sportspark":"اسپورٹس پارک",
    "club":"کلب","university":"یونیورسٹی","academy":"اکیڈمی","arena":"ایرینا","council":"کونسل",
    "super":"سپر","kings":"کنگز","king":"کنگ","queens":"کوئنز","knight":"نائٹ","riders":"رائیڈرز",
    "royals":"رائلز","royal":"رائل","warriors":"وارئیرز","strikers":"اسٹرائیکرز","heat":"ہیٹ",
    "stars":"اسٹارز","thunder":"تھنڈر","sixers":"سکسرز","scorchers":"اسکارچرز","hurricanes":"ہریکینز",
    "renegades":"رینیگیڈز","capitals":"کیپیٹلز","titans":"ٹائٹنز","challengers":"چیلنجرز",
    "falcons":"فالکنز","tigers":"ٹائیگرز","lions":"لائنز","eagles":"ایگلز","phoenix":"فینکس",
    "fire":"فائر","spirit":"اسپرٹ","brave":"بریو","rockets":"راکٹس","invincibles":"اِنونسبلز",
    "women":"ویمن","men":"مین","city":"سٹی","bay":"بے","mount":"ماؤنٹ","new":"نیو","old":"اولڈ",
    "abu":"ابو","dhabi":"دبئی","dubai":"دبئی","karachi":"کراچی","lahore":"لاہور","islamabad":"اسلام آباد",
    "peshawar":"پشاور","quetta":"کوئٹہ","multan":"ملتان","mumbai":"ممبئی","chennai":"چنئی",
    "kolkata":"کولکتہ","delhi":"دہلی","bengaluru":"بنگلورو","hyderabad":"حیدرآباد","jaipur":"جے پور",
    "adelaide":"ایڈیلیڈ","brisbane":"برسبین","melbourne":"میلبرن","sydney":"سڈنی","perth":"پرتھ",
    "hobart":"ہوبارٹ","london":"لندن","birmingham":"برمنگھم","manchester":"مانچسٹر","cardiff":"کارڈف",
    "auckland":"آکلینڈ","wellington":"ویلنگٹن","canterbury":"کینٹربری","otago":"اوٹاگو","kandy":"کینڈی",
    "colombo":"کولمبو","galle":"گال","dambulla":"دمبولا","jaffna":"جافنا","cape":"کیپ","town":"ٹاؤن",
    "durban":"ڈربن","pretoria":"پریٹوریا","paarl":"پارل","joburg":"جوبرگ","washington":"واشنگٹن",
    "texas":"ٹیکساس","seattle":"سیٹل","california":"کیلیفورنیا","san":"سان","francisco":"فرانسسکو",
    "los":"لاس","angeles":"اینجلس","nepal":"نیپال","kathmandu":"کھٹمنڈو","pokhara":"پکھرا",
    "biratnagar":"بیرات نگر","lumbini":"لمبینی","janakpur":"جنک پور","ranchi":"رانچی",
    ...{"adelaide":"ایڈیلیڈ","abu":"ابو","dhabi":"ظہبی","antigua":"انٹیگوا","hawksbills":"ہاکس بلز","barbados":"بارباڈوس","barisal":"باریسال","birmingham":"برمنگھم","brisbane":"برسبین","cape":"کیپ","town":"ٹاؤن","chattogram":"چٹگرام","chittagong":"چٹاگانگ","chennai":"چنئی","chitwan":"چتوان","colombo":"کولمبو","comilla":"کومیلا","cumilla":"کومیلا","dambulla":"دمبولا","deccan":"دکن","delhi":"دہلی","desert":"ڈیزرٹ","dhaka":"ڈھاکہ","dubai":"دبئی","dublin":"ڈبلن","durban":"ڈربن","durbar":"دربار","durdanto":"درونتو","duronto":"درونتو","edinburgh":"ایڈنبرا","fortune":"فارچون","galle":"گال","gujarat":"گجرات","gulf":"گلف","guyana":"گیانا","hobart":"ہوبارٹ","hyderabad":"حیدرآباد","islamabad":"اسلام آباد","jaffna":"جافنا","jamaica":"جمیکا","janakpur":"جنک پور","joburg":"جوبرگ","jozi":"جوزی","kandy":"کینڈی","karachi":"کراچی","karnali":"کرنالی","kathmandu":"کھٹمنڈو","khulna":"کھلنا","kolkata":"کولکتہ","lahore":"لاہور","london":"لندن","lucknow":"لکھنؤ","lumbini":"لمبنی","manchester":"مانچسٹر","melbourne":"میلبرن","minister":"منسٹر","multan":"ملتان","mumbai":"ممبئی","nelson":"نیلسن","noakhali":"نوکھالی","northern":"ناردرن","oval":"اوول","paarl":"پارل","perth":"پرتھ","peshawar":"پشاور","pokhara":"پوکھرا","pretoria":"پریٹوریا","pune":"پونے","punjab":"پنجاب","quetta":"کوئٹہ","rajasthan":"راجستھان","rajshahi":"راجشاہی","rangpur":"رنگپور","rawalpindiz":"راولپنڈیز","rising":"رائزنگ","rotterdam":"روٹرڈیم","san":"سان","francisco":"فرانسسکو","seattle":"سیئٹل","sharjah":"شارجہ","sud ur":"سدر","sudur":"سدر","paschim":"پشچم","sunrisers":"سن رائزرز","sylhet":"سلهٹ","texas":"ٹیکساس","tornadoes":"ٹورنیڈوز","trent":"ٹرینٹ","trinidad":"ٹرینیڈاڈ","tshwane":"تشوانے","warriors":"وارئیرز","washington":"واشنگٹن","welsh":"ویلش","phoenix":"فینکس","spirit":"اسپرٹ","brave":"بریو","rockets":"راکٹس","invincibles":"اِنونسبلز","giants":"جائنٹس","royals":"رائلز","qalandars":"قلندرز","sultans":"سلطانز","zalmi":"زلمی","gladiators":"گلیڈی ایٹرز","scorchers":"اسکارچرز","hurricanes":"ہریکینز","renegades":"رینیگیڈز","sixers":"سکسرز","strikers":"اسٹرائیکرز","knight":"نائٹ","riders":"رائیڈرز","kings":"کنگز","capitals":"کیپیٹلز","titans":"ٹائٹنز","challengers":"چیلنجرز","warriorz":"وارئیرز","vipers":"وائپرز","unicorns":"یونی کورنز","orcas":"اورکاز","falcons":"فالکنز","sapphires":"سیفائرز","empress":"ایمپریس","supergiants":"سپر جائنٹس","super":"سپر","blitz":"بلٹز","heat":"ہیٹ","stars":"اسٹارز","thunder":"تھنڈر","originals":"اوریجنلز","fire":"فائر","warrior":"وارئیر"}
};
const ilmiCaptainWordUrdu = {
    "the":"دی","and":"اور","of":"آف","international":"انٹرنیشنل","national":"نیشنل",
    "cricket":"کرکٹ","stadium":"اسٹیڈیم","ground":"گراؤنڈ","oval":"اوول","park":"پارک",
    "field":"فیلڈ","centre":"سینٹر","center":"سینٹر","sports":"اسپورٹس","sportspark":"اسپورٹس پارک",
    "club":"کلب","university":"یونیورسٹی","academy":"اکیڈمی","arena":"ایرینا","council":"کونسل",
    "super":"سپر","kings":"کنگز","king":"کنگ","queens":"کوئنز","knight":"نائٹ","riders":"رائیڈرز",
    "royals":"رائلز","royal":"رائل","warriors":"وارئیرز","strikers":"اسٹرائیکرز","heat":"ہیٹ",
    "stars":"اسٹارز","thunder":"تھنڈر","sixers":"سکسرز","scorchers":"اسکارچرز","hurricanes":"ہریکینز",
    "renegades":"رینیگیڈز","capitals":"کیپیٹلز","titans":"ٹائٹنز","challengers":"چیلنجرز",
    "falcons":"فالکنز","tigers":"ٹائیگرز","lions":"لائنز","eagles":"ایگلز","phoenix":"فینکس",
    "fire":"فائر","spirit":"اسپرٹ","brave":"بریو","rockets":"راکٹس","invincibles":"اِنونسبلز",
    "women":"ویمن","men":"مین","city":"سٹی","bay":"بے","mount":"ماؤنٹ","new":"نیو","old":"اولڈ",
    "abu":"ابو","dhabi":"دبئی","dubai":"دبئی","karachi":"کراچی","lahore":"لاہور","islamabad":"اسلام آباد",
    "peshawar":"پشاور","quetta":"کوئٹہ","multan":"ملتان","mumbai":"ممبئی","chennai":"چنئی",
    "kolkata":"کولکتہ","delhi":"دہلی","bengaluru":"بنگلورو","hyderabad":"حیدرآباد","jaipur":"جے پور",
    "adelaide":"ایڈیلیڈ","brisbane":"برسبین","melbourne":"میلبرن","sydney":"سڈنی","perth":"پرتھ",
    "hobart":"ہوبارٹ","london":"لندن","birmingham":"برمنگھم","manchester":"مانچسٹر","cardiff":"کارڈف",
    "auckland":"آکلینڈ","wellington":"ویلنگٹن","canterbury":"کینٹربری","otago":"اوٹاگو","kandy":"کینڈی",
    "colombo":"کولمبو","galle":"گال","dambulla":"دمبولا","jaffna":"جافنا","cape":"کیپ","town":"ٹاؤن",
    "durban":"ڈربن","pretoria":"پریٹوریا","paarl":"پارل","joburg":"جوبرگ","washington":"واشنگٹن",
    "texas":"ٹیکساس","seattle":"سیٹل","california":"کیلیفورنیا","san":"سان","francisco":"فرانسسکو",
    "los":"لاس","angeles":"اینجلس","nepal":"نیپال","kathmandu":"کھٹمنڈو","pokhara":"پکھرا",
    "biratnagar":"بیرات نگر","lumbini":"لمبینی","janakpur":"جنک پور","ranchi":"رانچی"
};
function transliterateIlmiCaptainWord(word) {
    const w = String(word || "").toLowerCase();
    if (ilmiCaptainWordUrdu[w]) return ilmiCaptainWordUrdu[w];
    const clusters = {"tch":"چ","sh":"ش","ch":"چ","kh":"خ","gh":"غ","ph":"ف","th":"تھ","dh":"دھ","zh":"ژ","oo":"و","ee":"ی","aa":"ا","ai":"ے","au":"او","ou":"او","ng":"نگ","ck":"ک","qu":"کو","wh":"و"};
    const letters = {a:"ا",b:"ب",c:"ک",d:"ڈ",e:"ے",f:"ف",g:"گ",h:"ہ",i:"ی",j:"ج",k:"ک",l:"ل",m:"م",n:"ن",o:"و",p:"پ",q:"ق",r:"ر",s:"س",t:"ٹ",u:"و",v:"و",w:"و",x:"کس",y:"ی",z:"ز"};
    let out="";
    for (let i=0;i<w.length;) {
        let matched=false;
        for (const n of [3,2]) { const part=w.slice(i,i+n); if (clusters[part]) { out+=clusters[part]; i+=n; matched=true; break; } }
        if (matched) continue;
        out+=letters[w[i]] || w[i]; i++;
    }
    return out;
}

// --- USER-EDITABLE URDU CAPTAIN OVERRIDES (Ilmi Prediction only) ---
function getIlmiCaptainOverride(teamName) {
    try { const saved = JSON.parse(localStorage.getItem("ilmi_urdu_captain_overrides_v1") || "{}"); return String(saved[normalizeIlmiName(teamName)] || "").trim(); }
    catch (e) { return ""; }
}
function saveIlmiCaptainOverride(teamName, inputId) {
    const value = String(document.getElementById(inputId)?.value || "").trim();
    if (!value || /[A-Za-z]/.test(value) || !/[\u0600-\u06FF]/.test(value)) { alert("Captain ka naam sirf Urdu mein likhein."); return; }
    try { const saved = JSON.parse(localStorage.getItem("ilmi_urdu_captain_overrides_v1") || "{}"); saved[normalizeIlmiName(teamName)] = value; localStorage.setItem("ilmi_urdu_captain_overrides_v1", JSON.stringify(saved)); alert("Urdu captain name save ho gaya. Match band karke dobara kholein."); }
    catch (e) { alert("Captain name save nahi ho saka."); }
}
function resetIlmiCaptainOverride(teamName) {
    try { const saved = JSON.parse(localStorage.getItem("ilmi_urdu_captain_overrides_v1") || "{}"); delete saved[normalizeIlmiName(teamName)]; localStorage.setItem("ilmi_urdu_captain_overrides_v1", JSON.stringify(saved)); alert("Manual Urdu correction reset ho gayi. Match dobara kholein."); }
    catch (e) { alert("Correction reset nahi ho saki."); }
}
function renderIlmiCaptainEditor(team1, team2, value1 = "", value2 = "") {
    const urduTeam1 = getUrduTeamName(team1) || team1, urduTeam2 = getUrduTeamName(team2) || team2;
    const safe1 = String(value1 || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const safe2 = String(value2 || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const esc1 = String(team1).replace(/'/g,"\\'"), esc2 = String(team2).replace(/'/g,"\\'");
    return '<details style="margin-top:14px;padding:10px;border:1px solid #475569;border-radius:8px;background:#0f172a;"><summary style="cursor:pointer;color:#e2e8f0;font-weight:bold;">✍️ کپتان کا اردو نام درست کریں</summary><p style="font-size:11px;color:#94a3b8;">صرف اردو میں نام لکھیں۔ یہ تبدیلی صرف Ilmi Prediction کے لیے اس browser میں محفوظ ہوگی۔</p>' +
    '<label style="display:block;color:#00ffcc;margin:8px 0 4px;">'+urduTeam1+' — کپتان</label><input id="ilmiCaptainUrdu1" dir="rtl" lang="ur" value="'+safe1+'" placeholder="کپتان کا نام اردو میں" style="width:100%;box-sizing:border-box;padding:9px;border-radius:6px;background:#1e293b;color:white;font-size:16px;">' +
    '<div style="display:flex;gap:8px;margin:7px 0 12px;"><button onclick="saveIlmiCaptainOverride(\''+esc1+'\',\'ilmiCaptainUrdu1\')" style="flex:1;padding:8px;background:#0d9488;color:white;border:0;border-radius:5px;">محفوظ کریں</button><button onclick="resetIlmiCaptainOverride(\''+esc1+'\')" style="padding:8px;background:#475569;color:white;border:0;border-radius:5px;">ری سیٹ</button></div>' +
    '<label style="display:block;color:#ff4d4d;margin:8px 0 4px;">'+urduTeam2+' — کپتان</label><input id="ilmiCaptainUrdu2" dir="rtl" lang="ur" value="'+safe2+'" placeholder="کپتان کا نام اردو میں" style="width:100%;box-sizing:border-box;padding:9px;border-radius:6px;background:#1e293b;color:white;font-size:16px;">' +
    '<div style="display:flex;gap:8px;margin:7px 0 0;"><button onclick="saveIlmiCaptainOverride(\''+esc2+'\',\'ilmiCaptainUrdu2\')" style="flex:1;padding:8px;background:#0d9488;color:white;border:0;border-radius:5px;">محفوظ کریں</button><button onclick="resetIlmiCaptainOverride(\''+esc2+'\')" style="padding:8px;background:#475569;color:white;border:0;border-radius:5px;">ری سیٹ</button></div></details>';
}

function transliterateIlmiCaptainName(value) {
    return String(value || "").trim().split(/([\\s,.'’()&/-]+)/).map(part => {
        if (!part || /^[\\s,.'’()&/-]+$/.test(part)) return part;
        return transliterateIlmiCaptainWord(part);
    }).join("");
}
function transliterateIlmiWord(word) {
    const w = String(word || "").toLowerCase();
    if (ilmiWordUrdu[w]) return ilmiWordUrdu[w];
    const clusters = {"tch":"چ","sh":"ش","ch":"چ","kh":"خ","gh":"غ","ph":"ف","th":"تھ","dh":"دھ","zh":"ژ","oo":"و","ee":"ی","aa":"ا","ai":"ے","au":"او","ou":"او","ng":"نگ","ck":"ک","qu":"کو","wh":"و"};
    const letters = {a:"ا",b:"ب",c:"ک",d:"ڈ",e:"ے",f:"ف",g:"گ",h:"ہ",i:"ی",j:"ج",k:"ک",l:"ل",m:"م",n:"ن",o:"و",p:"پ",q:"ق",r:"ر",s:"س",t:"ٹ",u:"و",v:"و",w:"و",x:"کس",y:"ی",z:"ز"};
    let out="";
    for (let i=0;i<w.length;) {
        let matched=false;
        for (const n of [3,2]) { const part=w.slice(i,i+n); if (clusters[part]) { out+=clusters[part]; i+=n; matched=true; break; } }
        if (matched) continue;
        out+=letters[w[i]] || w[i]; i++;
    }
    return out;
}
function transliterateIlmiName(value) {
    return String(value || "").trim().split(/([\s,.'’()&/-]+)/).map(part => {
        if (!part || /^[\s,.'’()&/-]+$/.test(part)) return part;
        return transliterateIlmiWord(part);
    }).join("");
}

function getUrduTeamName(value) {
    if (urduTeams[value]) return urduTeams[value];
    const normalized = normalizeIlmiName(value);
    const key = Object.keys(urduTeams).find(k => normalizeIlmiName(k) === normalized);
    if (key) return urduTeams[key];
    const raw = String(value || "").trim();
    if (/\s+women$/i.test(raw)) {
        const base = raw.replace(/\s+women$/i, "").trim();
        if (urduTeams[base]) return urduTeams[base] + " ویمن";
    }
    return "";
}

// --- CURRENT INTERNATIONAL / LEAGUE VENUES (API venue name -> Urdu) ---
const urduVenues = {
    "Tribhuvan University International Cricket Ground": "تری بھون یونیورسٹی انٹرنیشنل کرکٹ گراؤنڈ",
    "Rawalpindi Cricket Stadium": "راولپنڈی کرکٹ اسٹیڈیم",
    "LC de Villiers Oval": "ایل سی ڈی ویلیئرز اوول",
    "Tuks Cricket Oval": "ٹکس کرکٹ اوول",
    "Willowmoore Park": "ولو مور پارک",
    "Sahara Willowmoore Park": "سہارا ولو مور پارک",
    "North Sydney Oval": "نارتھ سڈنی اوول",
    "Entebbe Cricket Oval": "اینٹبے کرکٹ اوول",

    "TU International Cricket Ground": "ٹی یو انٹرنیشنل کرکٹ گراؤنڈ",
    "TU Cricket Ground": "ٹی یو کرکٹ گراؤنڈ",
    "Kirtipur Cricket Ground": "کیرتی پور کرکٹ گراؤنڈ",
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
    "Sheikh Zayed Stadium": "شیخ زاید کرکٹ اسٹیڈیم",
    "Zayed Sports City Cricket Stadium": "زاید اسپورٹس سٹی کرکٹ اسٹیڈیم",
    "Abu Dhabi Cricket Stadium": "ابو ظہبی کرکٹ اسٹیڈیم",
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
    "Wanderers Cricket Ground": "وانڈررز کرکٹ گراؤنڈ",
    "Junction Oval": "جنکشن اوول",
    "CitiPower Centre": "سٹی پاور سینٹر",
    "Karen Rolton Oval": "کیرن رولٹن اوول",
    "Allan Border Field": "ایلن بارڈر فیلڈ",
    "North Sydney Oval": "نارتھ سڈنی اوول",
    "Drummoyne Oval": "ڈروموئن اوول",
    "WACA Ground": "واکا گراؤنڈ",
    "Ninja Stadium": "ننجا اسٹیڈیم",
    "Hurstville Oval": "ہرسٹ وِل اوول",
    "Blacktown International Sportspark": "بلیک ٹاؤن انٹرنیشنل اسپورٹس پارک",
    "Great Barrier Reef Arena": "گریٹ بیریئر ریف ایرینا",
    "Riverway Stadium": "ریور وے اسٹیڈیم"
};
function getUrduVenueName(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (urduVenues[raw]) return urduVenues[raw];
    const key = Object.keys(urduVenues).find(k => normalizeIlmiName(k) === normalizeIlmiName(raw));
    // Unknown venue labels are transliterated; geographic verification remains strict.
    return key ? urduVenues[key] : transliterateIlmiName(raw);
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
    "Sandeep Lamichhane": "سندیپ لامیچھانے",
    "Kushal Malla": "کشل ملا",
    "Harmeet Singh": "ہرمیت سنگھ",
    "Sompal Kami": "سومپال کامی",
    "Karan KC": "کرن کے سی",
    "Rohit Paudel": "روہت پاوڈیل",
    "Kushal Bhurtel": "کشل بھرتیل",
    "Dipendra Singh Airee": "دیپیندر سنگھ آئری",
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
    "Jacob Bethell": "جیکب بیتھل",
    "Tahlia McGrath": "تالیہ میک گرا",
    "Georgia Redmayne": "جارجیا ریڈمین",
    "Nicola Carey": "نکولا کیری",
    "Sophie Molineux": "سوفی مولینیو",
    "Meg Lanning": "میگ لیننگ",
    "Sophie Devine": "سوفی ڈیوائن",
    "Beth Mooney": "بیتھ مونی",
    "Ashleigh Gardner": "ایشلی گارڈنر",
    "Phoebe Litchfield": "فوبی لچفیلڈ",
    "Imran Tahir": "عمران طاہر",
    "Roston Chase": "روسٹن چیز",
    "Moeen Ali": "معین علی",
    "Chris Green": "کرس گرین",
    "Rovman Powell": "روومین پاول",
    "Matt Short": "میٹ شارٹ",
    "Nathan Ellis": "نیتھن ایلس",
    "Will Sutherland": "ول سدرلینڈ",
    "Marcus Stoinis": "مارکس اسٹوئنس",
    "Najmul Hossain Shanto": "نجمل حسین شانتو",
    "Mahedi Hasan": "مہدی حسن",
    "Mehidy Hasan Miraz": "مہدی حسن میراز",
    "Nurul Hasan Sohan": "نور الحسن سوہان",
    "Mohammad Mithun": "محمد متھن",
    "Haider Ali": "حیدر علی",
    "Azmatullah Omarzai": "عظمت اللہ عمرزئی",
    "Kieron Pollard": "کیرون پولارڈ",
    "Fakhar Zaman": "فخر زمان",
    "Smriti Mandhana": "اسمرتی مندھانا",
    "Fatima Sana": "فاطمہ ثنا",
    "Esha Oza": "ایشا اوزا",
    "Harpreet Singh": "ہربریت سنگھ"
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
    "Biratnagar Kings": "Sandeep Lamichhane",
    "Chitwan Rhinos": "Kushal Malla",
    "Janakpur Bolts": "Harmeet Singh",
    "Karnali Yaks": "Sompal Kami",
    "Kathmandu Gorkhas": "Karan KC",
    "Kathmandu Gurkhas": "Karan KC",
    "Lumbini Lions": "Rohit Paudel",
    "Pokhara Avengers": "Kushal Bhurtel",
    "Sudurpaschim Royals": "Dipendra Singh Airee",
    // Caribbean Premier League 2026
    "Trinbago Knight Riders": "Nicholas Pooran",
    "Guyana Amazon Warriors": "Imran Tahir",
    "St Lucia Kings": "Roston Chase",
    "Saint Lucia Kings": "Roston Chase",
    "St Kitts & Nevis Patriots": "Jason Holder",
    "Antigua & Barbuda Falcons": "Moeen Ali",
    "Barbados Tridents": "Chris Green",
    "Jamaica Kingsmen": "Rovman Powell",
    // Big Bash League 2026-27: only publicly confirmed captains
    "Adelaide Strikers": "Matt Short",
    "Hobart Hurricanes": "Nathan Ellis",
    "Melbourne Renegades": "Will Sutherland",
    "Melbourne Stars": "Marcus Stoinis",
    "Perth Scorchers": "Ashton Turner",
    // Bangladesh Premier League 2026
    "Rajshahi Warriors": "Najmul Hossain Shanto",
    "Chattogram Royals": "Mahedi Hasan",
    "Sylhet Titans": "Mehidy Hasan Miraz",
    "Rangpur Riders": "Nurul Hasan Sohan",
    "Dhaka Capitals": "Mohammad Mithun",
    "Noakhali Express": "Haider Ali",
    // Afghanistan Premier League 2026
    "Akcel United Kabul": "Azmatullah Omarzai",
    "Balkh Zwanan": "Ibrahim Zadran",
    "Kandahar Warriors": "Rashid Khan",
    "Nangarhar Cosmic": "Rahmat Shah",
    "Paktia": "Rahmanullah Gurbaz",
    // Abu Dhabi T10 2026: captains announced by the official tournament
    "UAE Bulls": "Kieron Pollard",
    "Yas Lions": "Jason Holder",
    "Royal Desert Champions": "Nicholas Pooran",
    "Emirates Eagles": "Rovman Powell",
    "United Tigers": "Fakhar Zaman",
    "Arabian Aces": "Moeen Ali",
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
    "Welsh Fire": "Phil Salt",
    "Adelaide Strikers Women": "Tahlia McGrath",
    "Brisbane Heat Women": "Georgia Redmayne",
    "Hobart Hurricanes Women": "Nicola Carey",
    "Melbourne Renegades Women": "Sophie Molineux",
    "Melbourne Stars Women": "Meg Lanning",
    "Perth Scorchers Women": "Beth Mooney",
    "Sydney Sixers Women": "Ashleigh Gardner",
    "Sydney Thunder Women": "Phoebe Litchfield"
};

// International men's teams: format-wise captains.
// If a format has no separately confirmed captain in the latest available
// captain listing, the most recently documented captain is used as fallback.
const internationalCaptains = {
    "Afghanistan": { "Test": "Rahmat Shah", "ODI": "Rahmat Shah", "T20": "Ibrahim Zadran" },
    "Australia": { "Test": "Pat Cummins", "ODI": "Mitchell Marsh", "T20": "Mitchell Marsh" },
    "Bangladesh": { "Test": "Najmul Hossain Shanto", "ODI": "Litton Das", "T20": "Litton Das" },
    "England": { "Test": "Joe Root", "ODI": "Harry Brook", "T20": "Jacob Bethell" },
    "India": { "Test": "Shubman Gill", "ODI": "Shubman Gill", "T20": "Shreyas Iyer" },
    "Ireland": { "Test": "Andrew Balbirnie", "ODI": "Paul Stirling", "T20": "Lorcan Tucker" },
    "New Zealand": { "Test": "Tom Latham", "ODI": "Mitchell Santner", "T20": "Mitchell Santner" },
    "Pakistan": { "Test": "Babar Azam", "ODI": "Shaheen Afridi", "T20": "Sahibzada Farhan" },
    "South Africa": { "Test": "Temba Bavuma", "ODI": "Temba Bavuma", "T20": "Aiden Markram" },
    "Sri Lanka": { "Test": "Kusal Mendis", "ODI": "Dasun Shanaka", "T20": "Dasun Shanaka" },
    "West Indies": { "Test": "Roston Chase", "ODI": "Shai Hope", "T20": "Shai Hope" },
    "Zimbabwe": { "Test": "Richard Ngarava", "ODI": "Sikandar Raza", "T20": "Sikandar Raza" },
    "United Arab Emirates": { "ODI": "Harpreet Singh", "T20": "Muhammad Waseem" },
    "UAE": { "ODI": "Harpreet Singh", "T20": "Muhammad Waseem" },
    "Oman": { "ODI": "Vinayak Shukla", "T20": "Vinayak Shukla" },
    // Women's national captaincies confirmed by 2026 board/tournament announcements
    "India Women": { "ODI": "Smriti Mandhana", "T20": "Smriti Mandhana" },
    "Pakistan Women": { "ODI": "Fatima Sana", "T20": "Fatima Sana" },
    "UAE Women": { "ODI": "Esha Oza", "T20": "Esha Oza" }
};

// Strict Ilmi eligibility: international fixtures + franchise leagues present in the Cricsheet training export.
const ilmiInternationalTeams = new Set(["Afghanistan","Africa XI","Argentina","Asia XI","Australia","Austria","Bahamas","Bahrain","Bangladesh","Barbados","Belgium","Belize","Bermuda","Bhutan","Botswana","Brazil","Bulgaria","Cambodia","Cameroon","Canada","Cayman Islands","Chile","China","Cook Islands","Costa Rica","Croatia","Cyprus","Czech Republic","Denmark","England","Estonia","Eswatini","Fiji","Finland","France","Gambia","Germany","Ghana","Gibraltar","Greece","Guernsey","Hong Kong","Hungary","ICC World XI","India","Indonesia","Iran","Ireland","Isle of Man","Israel","Italy","Ivory Coast","Japan","Jersey","Kenya","Kuwait","Lesotho","Luxembourg","Malawi","Malaysia","Maldives","Mali","Malta","Mexico","Mongolia","Mozambique","Myanmar","Namibia","Nepal","Netherlands","New Zealand","Nigeria","Norway","Oman","Pakistan","Panama","Papua New Guinea","Peru","Philippines","Portugal","Qatar","Romania","Rwanda","Samoa","Saudi Arabia","Scotland","Serbia","Seychelles","Sierra Leone","Singapore","Slovenia","South Africa","South Korea","Spain","Sri Lanka","St Helena","Suriname","Swaziland","Sweden","Switzerland","Tanzania","Thailand","Timor-Leste","Turkey","Turks and Caicos Island","Uganda","United Arab Emirates","United States of America","Uzbekistan","Vanuatu","West Indies","Zambia","Zimbabwe"].map(normalizeIlmiName));
const ilmiMajorCompetitions = new Set(["Indian Premier League","Pakistan Super League","Big Bash League","Women's Big Bash League","Bangladesh Premier League","Caribbean Premier League","Women's Caribbean Premier League","The Hundred Men's Competition","The Hundred Women's Competition","Lanka Premier League","International League T20","Major League Cricket","SA20","Nepal Premier League","Mzansi Super League","FairBreak Invitational Tournament","Women's Premier League","Women's Cricket Super League","Women's T20 Challenge","European T20 Premier League","Abu Dhabi T10","Abu Dhabi T10 League","IPL","PSL","BBL","WBBL","BPL","CPL","WCPL","The Hundred","LPL","ILT20","MLC","WPL","T10"].map(normalizeIlmiName));
function isIlmiInternationalTeam(name) {
    const raw = String(name || "").trim();
    const base = raw.replace(/\s+women$/i, "");
    const key = normalizeIlmiName(base);
    const aliases = { "usa":"unitedstatesofamerica", "unitedstates":"unitedstatesofamerica", "uae":"unitedarabemirates" };
    return ilmiInternationalTeams.has(aliases[key] || key);
}
function ilmiCaptainForEligibility(name, format) {
    const normalized = normalizeIlmiName(name);
    const internationalKey = Object.keys(internationalCaptains)
        .find(key => normalizeIlmiName(key) === normalized);
    if (internationalKey) return internationalCaptains[internationalKey][format] || "";
    const franchiseKey = Object.keys(teamCaptains)
        .find(key => normalizeIlmiName(key) === normalized);
    return franchiseKey ? teamCaptains[franchiseKey] : "";
}
function isIlmiEligibleFixture(team1, team2, competitionTitle, format = "T20") {
    const isInternational = isIlmiInternationalTeam(team1) && isIlmiInternationalTeam(team2);
    const competitionKey = normalizeIlmiName(competitionTitle);
    const isMajorLeague = ilmiMajorCompetitions.has(competitionKey) ||
        Array.from(ilmiMajorCompetitions).some(name => competitionKey.startsWith(name));
    if (!isInternational && !isMajorLeague) return false;
    // Fail closed until both teams have a current captain and Urdu mappings.
    return [team1, team2].every(name => {
        const captain = ilmiCaptainForEligibility(name, format);
        return Boolean(captain && urduCaptains[captain] && getUrduTeamName(name));
    });
}

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

// Toss Time is a separate Ilmi factor; it does not replace the existing match-time factor.
function getIlmiTossTimeNumber(timeValue) {
    const match = String(timeValue || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    const digitSum = String(timeValue).replace(":", "").split("")
        .reduce((sum, digit) => sum + Number(digit), 0);
    const reduced = reduceToSingle(digitSum);
    return reduced || 9;
}

function getIlmiTossTimeCompatibility(teamBaseNumber, tossTimeNumber) {
    const teamNumber = reduceToSingle(teamBaseNumber);
    const rules = friendshipMatrix[tossTimeNumber] || { friends: [], enemies: [] };
    if (rules.friends.includes(teamNumber)) return { status: "Friendly", multiplier: 1.03 };
    if (rules.enemies.includes(teamNumber)) return { status: "Hostile", multiplier: 0.97 };
    return { status: "Neutral", multiplier: 1.00 };
}

const ilmiChaldeanPlanets = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];
const ilmiPlanetNumbers = { Sun: 1, Moon: 2, Jupiter: 3, Mars: 9, Venus: 6, Mercury: 5, Saturn: 8 };
const ilmiWeekdayRulers = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
function ilmiMinutes(value) {
    const m = String(value || "").match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function getIlmiPlanetaryHour(timeValue, sunriseValue, sunsetValue, nextSunriseValue, weekdayIndex) {
    const now = ilmiMinutes(timeValue), sunrise = ilmiMinutes(sunriseValue);
    const sunset = ilmiMinutes(sunsetValue), nextSunrise = ilmiMinutes(nextSunriseValue);
    if ([now, sunrise, sunset, nextSunrise].some(v => v === null) || sunrise >= sunset) return null;
    const rulerIndex = ilmiChaldeanPlanets.indexOf(ilmiWeekdayRulers[weekdayIndex]);
    if (rulerIndex < 0) return null;
    let hourIndex, segment, start;
    if (now >= sunrise && now < sunset) {
        segment = (sunset - sunrise) / 12;
        hourIndex = Math.min(11, Math.floor((now - sunrise) / segment));
        start = sunrise + hourIndex * segment;
    } else if (now >= sunset) {
        segment = (1440 - sunset + nextSunrise) / 12;
        hourIndex = 12 + Math.min(11, Math.floor((now - sunset) / segment));
        start = sunset + (hourIndex - 12) * segment;
    } else {
        return { error: "Toss sunrise se pehle hai; previous sunset timing bhi verify karni hogi." };
    }
    const planet = ilmiChaldeanPlanets[(rulerIndex + hourIndex) % 7];
    return { planet, number: ilmiPlanetNumbers[planet], hour: hourIndex + 1,
        startsAt: String(Math.floor(start / 60) % 24).padStart(2,"0") + ":" + String(Math.floor(start % 60)).padStart(2,"0") };
}
function getIlmiMatrixRelation(number, contextNumber) {
    const n = reduceToSingle(number), rules = friendshipMatrix[reduceToSingle(contextNumber)] || { friends: [], enemies: [] };
    if (rules.friends.includes(n)) return { status: "Friendly", multiplier: 1.03 };
    if (rules.enemies.includes(n)) return { status: "Hostile", multiplier: 0.97 };
    return { status: "Neutral", multiplier: 1.00 };
}

function applyIlmiTossTimeFactor() {
    const state = window.ilmiTossBaseState;
    const result = document.getElementById("ilmi-toss-result");
    const timeInput = document.getElementById("ilmi-toss-time");
    if (!state || !result || !timeInput) return;
    const tossTimeNumber = getIlmiTossTimeNumber(timeInput.value);
    if (tossTimeNumber === null) {
        result.textContent = "Exact toss time HH:MM enter karein.";
        return;
    }
    const tossWinner = document.getElementById("toss-winner")?.value || "";
    const tossDecision = document.getElementById("toss-decision")?.value || "";
    if (![state.team1, state.team2].includes(tossWinner) || !tossDecision) {
        result.textContent = "Toss winner aur Bat/Field decision select karein.";
        return;
    }
    if (state.matchStartTime && tossTimeNumber !== null && timeInput.value >= state.matchStartTime) {
        result.textContent = "Toss time scheduled match start se pehle hona chahiye (venue local time).";
        return;
    }
    if (!state.nextSunrise) {
        result.textContent = "Planetary hour ke liye next-day sunrise timing load nahi hui.";
        return;
    }
    const planetary = getIlmiPlanetaryHour(timeInput.value, state.sunrise, state.sunset, state.nextSunrise, state.weekdayIndex);
    if (!planetary || planetary.error) {
        result.textContent = planetary?.error || "Planetary hour calculate nahi ho saka.";
        return;
    }
    const winnerIsA = tossWinner === state.team1;
    const winnerBase = winnerIsA ? state.baseA : state.baseB;
    const teamAdad = winnerIsA ? state.teamAdadA : state.teamAdadB;
    const captainAdad = winnerIsA ? state.captainAdadA : state.captainAdadB;
    const teamRelation = getIlmiMatrixRelation(teamAdad, planetary.number);
    const captainRelation = getIlmiMatrixRelation(captainAdad, planetary.number);
    const planetMultiplier = teamRelation.multiplier === captainRelation.multiplier ? teamRelation.multiplier : 1.00;
    const decisionAdad = reduceToSingle(calculateAbjad(tossDecision === "bat" ? "ضرب" : "دفاع"));
    const decisionRelation = getIlmiMatrixRelation(winnerBase, decisionAdad);
    const digitRelationA = getIlmiTossTimeCompatibility(state.baseA, tossTimeNumber);
    const digitRelationB = getIlmiTossTimeCompatibility(state.baseB, tossTimeNumber);
    const winnerFactor = planetMultiplier * decisionRelation.multiplier;
    const finalA = state.baseA * state.contextMultA * state.matchTimeMultA * digitRelationA.multiplier * (winnerIsA ? winnerFactor : 1);
    const finalB = state.baseB * state.contextMultB * state.matchTimeMultB * digitRelationB.multiplier * (!winnerIsA ? winnerFactor : 1);
    const winner = finalA > finalB ? state.team1 : (finalB > finalA ? state.team2 : "Tie");
    result.innerHTML =
        '<div>Planetary Hour: <b>' + planetary.planet + '</b> (Hour ' + planetary.hour + ', ' + planetary.startsAt + ') — Number <b>' + planetary.number + '</b></div>' +
        '<div>Toss: <b>' + tossWinner + '</b> — <b>' + (tossDecision === "bat" ? "Bat First" : "Field First") + '</b></div>' +
        '<div>Winner team compatibility: ' + teamRelation.status + '; captain: ' + captainRelation.status + '; decision: ' + decisionRelation.status + '</div>' +
        '<div>Time-number compatibility: ' + state.team1 + ' ' + digitRelationA.status + ' / ' + state.team2 + ' ' + digitRelationB.status + '</div>' +
        '<div><b>Final Ilmi scores:</b> ' + state.team1 + ' ' + finalA.toFixed(2) + ' | ' + state.team2 + ' ' + finalB.toFixed(2) + '</div>' +
        '<div><b>Ilmi result: ' + winner + '</b></div>';
    const scoreCells = document.querySelectorAll("#ilmi-content table tr td:last-child");
    if (scoreCells.length >= 2) { scoreCells[0].textContent = finalA.toFixed(2); scoreCells[1].textContent = finalB.toFixed(2); }
    const winnerLabel = document.querySelector("#ilmi-content > div[style*='text-align: center']");
    if (winnerLabel) winnerLabel.textContent = "🌟 " + winner + " Ka Pala Bhari Hai!";
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

// Resolve every cricket venue globally from feed coordinates or Open-Meteo geocoding.
// Never depend on a country-specific hardcoded stadium/timezone list.
function validVenueCoordinates(latitude, longitude) {
    const lat = Number(latitude), lon = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) &&
        lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 &&
        !(lat === 0 && lon === 0) ? { latitude: lat, longitude: lon } : null;
}

function extractVenueCoordinates(venueMeta = {}) {
    const candidates = [
        [venueMeta.latitude, venueMeta.longitude],
        [venueMeta.lat, venueMeta.lon],
        [venueMeta.lat, venueMeta.lng],
        [venueMeta.geo?.latitude, venueMeta.geo?.longitude],
        [venueMeta.coordinates?.latitude, venueMeta.coordinates?.longitude],
        [venueMeta.coordinates?.lat, venueMeta.coordinates?.lng]
    ];
    for (const pair of candidates) {
        const coords = validVenueCoordinates(pair[0], pair[1]);
        if (coords) return coords;
    }
    return null;
}

function isValidIanaTimezone(zone) {
    if (!zone || typeof zone !== 'string') return false;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
        return true;
    } catch (_) { return false; }
}

// Global venue resolver: use feed coordinates first, then an exact named-ground POI.
// City-centre coordinates are deliberately rejected because they are not venue-accurate.
// Team names and competition are retained as context, never treated as proof of venue.
const VENUE_CACHE_KEY = "ilmi_verified_venue_locations_v3";
const VENUE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

function normalizeVenueText(value) {
    return String(value || "").normalize("NFKD").toLowerCase()
        .replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}
let globalGroundRegistryPromise = null;
async function loadGlobalGroundRegistry() {
    if (!globalGroundRegistryPromise) {
        globalGroundRegistryPromise = fetch("./data/grounds.json", { cache: "force-cache" })
            .then(response => response.ok ? response.json() : null)
            .then(data => Array.isArray(data?.grounds) ? data.grounds : [])
            .catch(() => []);
    }
    return globalGroundRegistryPromise;
}
async function findGlobalGround(venue) {
    const target = normalizeVenueText(venue);
    if (!target) return null;
    const grounds = await loadGlobalGroundRegistry();
    const matches = grounds.filter(ground => {
        const names = [ground.name, ...(ground.aliases || [])];
        return names.some(name => normalizeVenueText(name) === target);
    });
    if (matches.length !== 1) return null;
    const ground = matches[0];
    const coords = validVenueCoordinates(ground.latitude, ground.longitude);
    if (!coords || !isValidIanaTimezone(ground.timezone)) return null;
    return {
        ...coords, timezone: ground.timezone, source: "global-ground-directory",
        confidence: ground.verification_status === "verified" ? 100 : 85,
        resolvedName: ground.name, resolvedCity: ground.city,
        resolvedCountry: ground.country,
        verificationStatus: ground.verification_status || "needs_user_verification"
    };
}
function readVenueCache(key) {
    try {
        const cache = JSON.parse(localStorage.getItem(VENUE_CACHE_KEY) || "{}");
        const item = cache[key];
        if (item && Date.now() - item.savedAt < VENUE_CACHE_TTL &&
            validVenueCoordinates(item.latitude, item.longitude) && isValidIanaTimezone(item.timezone)) return item;
    } catch (_) {}
    return null;
}
function writeVenueCache(key, location) {
    try {
        const cache = JSON.parse(localStorage.getItem(VENUE_CACHE_KEY) || "{}");
        cache[key] = { ...location, savedAt: Date.now() };
        const entries = Object.entries(cache).sort((a,b) => (b[1].savedAt || 0) - (a[1].savedAt || 0)).slice(0,250);
        localStorage.setItem(VENUE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch (_) {}
}
function collectVenueHints(meta = {}) {
    const values = [];
    const visit = (obj, depth = 0) => {
        if (!obj || typeof obj !== "object" || depth > 2) return;
        for (const [key,value] of Object.entries(obj)) {
            if (typeof value === "string" && /(city|town|district|country|venue|ground|stadium|location|address)/i.test(key)) values.push(value);
            else if (value && typeof value === "object") visit(value, depth + 1);
        }
    };
    visit(meta);
    return [...new Set(values.map(v => v.trim()).filter(Boolean))];
}
async function timezoneForCoordinates(coords) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&daily=sunrise&forecast_days=1&timezone=auto`;
        const response = await fetch(url);
        if (!response.ok) return "";
        const data = await response.json();
        return isValidIanaTimezone(data.timezone) ? data.timezone : "";
    } catch (_) { return ""; }
}
async function resolveVenueLocation(city, country, venue, venueMeta = {}, timezoneHint = '', matchContext = {}) {
    // Verified venue registry: exact aliases bypass unreliable/missing feed geodata.
    // TU International Cricket Ground is in Kirtipur, Nepal (IANA zone Asia/Kathmandu).
    const verifiedGrounds = {
        "zayed cricket stadium": { latitude: 24.3966, longitude: 54.5407, timezone: "Asia/Dubai", name: "Zayed Cricket Stadium", city: "Abu Dhabi", country: "United Arab Emirates" },
        "sheikh zayed stadium": { latitude: 24.3966, longitude: 54.5407, timezone: "Asia/Dubai", name: "Zayed Cricket Stadium", city: "Abu Dhabi", country: "United Arab Emirates" },
        "sheikh zayed cricket stadium": { latitude: 24.3966, longitude: 54.5407, timezone: "Asia/Dubai", name: "Zayed Cricket Stadium", city: "Abu Dhabi", country: "United Arab Emirates" },
        "zayed sports city cricket stadium": { latitude: 24.3966, longitude: 54.5407, timezone: "Asia/Dubai", name: "Zayed Cricket Stadium", city: "Abu Dhabi", country: "United Arab Emirates" },
        "abu dhabi cricket stadium": { latitude: 24.3966, longitude: 54.5407, timezone: "Asia/Dubai", name: "Zayed Cricket Stadium", city: "Abu Dhabi", country: "United Arab Emirates" },
        "tribhuvan university international cricket ground": { latitude: 27.67806, longitude: 85.29056, timezone: "Asia/Kathmandu", name: "Tribhuvan University International Cricket Ground", city: "Kirtipur", country: "Nepal" },
        "tu international cricket ground": { latitude: 27.67806, longitude: 85.29056, timezone: "Asia/Kathmandu", name: "Tribhuvan University International Cricket Ground", city: "Kirtipur", country: "Nepal" },
        "tu cricket ground": { latitude: 27.67806, longitude: 85.29056, timezone: "Asia/Kathmandu", name: "Tribhuvan University International Cricket Ground", city: "Kirtipur", country: "Nepal" },
        "kirtipur cricket ground": { latitude: 27.67806, longitude: 85.29056, timezone: "Asia/Kathmandu", name: "Tribhuvan University International Cricket Ground", city: "Kirtipur", country: "Nepal" },
        "rawalpindi cricket stadium": { latitude: 33.65139, longitude: 73.07611, timezone: "Asia/Karachi", name: "Rawalpindi Cricket Stadium", city: "Rawalpindi", country: "Pakistan" },
        "lc de villiers oval": { latitude: -25.750873, longitude: 28.247124, timezone: "Africa/Johannesburg", name: "LC de Villiers Oval", city: "Pretoria", country: "South Africa" },
        "tuks cricket oval": { latitude: -25.750873, longitude: 28.247124, timezone: "Africa/Johannesburg", name: "LC de Villiers Oval", city: "Pretoria", country: "South Africa" },
        "willowmoore park": { latitude: -26.19528, longitude: 28.31806, timezone: "Africa/Johannesburg", name: "Willowmoore Park", city: "Benoni", country: "South Africa" },
        "sahara willowmoore park": { latitude: -26.19528, longitude: 28.31806, timezone: "Africa/Johannesburg", name: "Willowmoore Park", city: "Benoni", country: "South Africa" },
        "north sydney oval": { latitude: -33.83194, longitude: 151.20944, timezone: "Australia/Sydney", name: "North Sydney Oval", city: "North Sydney", country: "Australia" },
        "entebbe cricket oval": { latitude: 0.0525425, longitude: 32.4675322, timezone: "Africa/Kampala", name: "Entebbe Cricket Oval", city: "Entebbe", country: "Uganda" }
    };
    const globalGround = await findGlobalGround(venue);
    if (globalGround) return globalGround;
    const verifiedGround = verifiedGrounds[normalizeVenueText(venue)];
    if (verifiedGround && isValidIanaTimezone(verifiedGround.timezone)) {
        const { name, city, country, ...coordinates } = verifiedGround;
        return { ...coordinates, source: "verified-venue-registry", confidence: 100,
            resolvedName: name, resolvedCity: city, resolvedCountry: country };
    }

    const directCoords = extractVenueCoordinates(venueMeta);
    if (directCoords) {
        const timezone = await timezoneForCoordinates(directCoords);
        if (timezone) return { ...directCoords, timezone, source: 'match-feed-coordinates', confidence: 100 };
    }

    const clean = value => {
        const v = String(value || '').trim();
        return !v || /^(unknown|null|n\/a|none)$/i.test(v) ? '' : v;
    };
    city = clean(city); country = clean(country); venue = clean(venue);
    const cacheKey = [venue, city, country].map(normalizeVenueText).join('|');
    const cached = readVenueCache(cacheKey);
    if (cached) return { ...cached, source: 'verified-cache' };

    // Capture every useful feed field for diagnostics and future disambiguation.
    const context = {
        teams: [matchContext.team1, matchContext.team2].filter(Boolean),
        competition: matchContext.competition || '',
        format: matchContext.format || '',
        startTime: matchContext.startTime || '',
        hints: collectVenueHints(venueMeta)
    };
    const venueNorm = normalizeVenueText(venue);
    const cityNorm = normalizeVenueText(city);
    const countryNorm = normalizeVenueText(country);
    const candidates = [];

    // Photon indexes OpenStreetMap POIs, including many named cricket grounds.
    // Exact POI-name matches are preferred over fuzzy city matches.
    if (venue) {
        const photonQueries = [];
        if (city || country) photonQueries.push([venue, city, country].filter(Boolean).join(', '));
        photonQueries.push(venue);
        for (const query of [...new Set(photonQueries)]) {
            try {
                const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=15&lang=en`);
                if (!response.ok) continue;
                const data = await response.json();
                for (const feature of (data.features || [])) {
                    const p = feature.properties || {};
                    const coords = validVenueCoordinates(feature.geometry?.coordinates?.[1], feature.geometry?.coordinates?.[0]);
                    if (!coords) continue;
                    const nameNorm = normalizeVenueText(p.name || p.street || '');
                    const resultCountry = normalizeVenueText(p.country || '');
                    const resultCity = normalizeVenueText(p.city || p.locality || p.county || '');
                    let score = 0;
                    if (venueNorm && nameNorm === venueNorm) score += 70;
                    else if (venueNorm && (nameNorm.includes(venueNorm) || venueNorm.includes(nameNorm))) score += 38;
                    if (countryNorm && resultCountry === countryNorm) score += 22;
                    else if (countryNorm && resultCountry && (resultCountry.includes(countryNorm) || countryNorm.includes(resultCountry))) score += 14;
                    if (cityNorm && resultCity === cityNorm) score += 18;
                    else if (cityNorm && resultCity && (resultCity.includes(cityNorm) || cityNorm.includes(resultCity))) score += 10;
                    const category = normalizeVenueText([p.osm_key,p.osm_value,p.type].join(' '));
                    if (/stadium|sports|pitch|track|leisure|ground/.test(category)) score += 12;
                    if (venueNorm && nameNorm && score >= 35) candidates.push({
                        ...coords, name: p.name || '', country: p.country || '', city: p.city || p.locality || '',
                        score, source: 'openstreetmap-photon'
                    });
                }
            } catch (error) { console.warn('Venue POI search failed:', query, error); }
        }
    }

    // Photon can return the same named ground from multiple query variants.
    // Treat nearby identical-name hits as one POI before comparing confidence;
    // otherwise duplicate copies make the best-vs-second score gap zero and
    // incorrectly reject a valid venue (for example, North Sydney Oval).
    const uniqueCandidates = [];
    for (const candidate of candidates) {
        const candidateName = normalizeVenueText(candidate.name);
        const duplicate = uniqueCandidates.find(existing => {
            if (!candidateName || normalizeVenueText(existing.name) !== candidateName) return false;
            const toRad = value => value * Math.PI / 180;
            const dLat = toRad(candidate.latitude - existing.latitude);
            const dLon = toRad(candidate.longitude - existing.longitude);
            const lat1 = toRad(existing.latitude), lat2 = toRad(candidate.latitude);
            const haversine = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
            const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
            return distanceKm <= 0.5;
        });
        if (!duplicate) uniqueCandidates.push(candidate);
        else if (candidate.score > duplicate.score) Object.assign(duplicate, candidate);
    }
    candidates.length = 0;
    candidates.push(...uniqueCandidates);
    candidates.sort((a,b) => b.score - a.score);
    if (candidates.length) {
        const best = candidates[0], second = candidates[1];
        // Require a strong venue-name match and separation from competing candidates.
        if (best.score >= 65 && (!second || best.score - second.score >= 12)) {
            const timezone = await timezoneForCoordinates(best);
            if (timezone) {
                const resolved = { latitude: best.latitude, longitude: best.longitude, timezone,
                    source: best.source, resolvedName: best.name, resolvedCountry: best.country,
                    confidence: best.score };
                writeVenueCache(cacheKey, resolved);
                return resolved;
            }
        }
    }

    // Never substitute city-centre coordinates for a cricket venue. That can
    // shift Maghrib and planetary-hour calculations by a material amount.
    console.warn('Venue unresolved; match context retained but not used as geographic proof', context);
    return null;
}
async function fetchMaghribTime(location, dateStr) {
    const empty = { maghrib: null, sunrise: null, sunset: null, timezone: location?.timezone || null, ok: false, error: 'not-requested' };
    const coords = location && validVenueCoordinates(location.latitude, location.longitude);
    if (!coords || !isValidIanaTimezone(location.timezone)) {
        return { ...empty, error: 'invalid-location-or-timezone' };
    }

    const parseTime = value => {
        if (value == null) return null;
        const match = String(value).trim().match(/(\d{1,2}:\d{2})(?::\d{2})?/);
        if (!match) return null;
        const [hour, minute] = match[1].split(':').map(Number);
        return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
            ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` : null;
    };

    // First ask AlAdhan to calculate timezone from coordinates itself. This avoids
    // a valid IANA zone string being rejected/misinterpreted by an upstream proxy.
    const attempts = [
        { label: 'coordinates-auto-timezone', params: `latitude=${coords.latitude}&longitude=${coords.longitude}&method=4` },
        { label: 'coordinates-explicit-timezone', params: `latitude=${coords.latitude}&longitude=${coords.longitude}&method=4&timezonestring=${encodeURIComponent(location.timezone)}` }
    ];
    let lastError = 'no-response';
    for (const attempt of attempts) {
        try {
            const url = `https://api.aladhan.com/v1/timings/${encodeURIComponent(dateStr)}?${attempt.params}`;
            const response = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
            const raw = await response.text();
            let data;
            try { data = JSON.parse(raw); } catch (_) {
                lastError = `non-json-response-${response.status}`;
                console.warn('AlAdhan returned non-JSON response', { attempt: attempt.label, status: response.status, body: raw.slice(0, 300) });
                continue;
            }
            if (!response.ok || Number(data.code) !== 200) {
                lastError = `http-${response.status}-api-${data.code || 'unknown'}`;
                console.warn('AlAdhan prayer request failed', { attempt: attempt.label, status: response.status, code: data.code, statusText: data.status, body: data.data || data.message });
                continue;
            }
            const timings = data.data?.timings || {};
            const maghrib = parseTime(timings.Maghrib || timings.maghrib) || parseTime(timings.Sunset || timings.sunset);
            const sunrise = parseTime(timings.Sunrise || timings.sunrise);
            const sunset = parseTime(timings.Sunset || timings.sunset);
            if (maghrib && sunrise && sunset) {
                return { maghrib, sunrise, sunset, timezone: location.timezone, ok: true,
                    source: attempt.label, date: dateStr };
            }
            lastError = `missing-times-${Object.keys(timings).join(',') || 'empty-timings'}`;
            console.warn('AlAdhan response missing required prayer times', { attempt: attempt.label, date: dateStr, keys: Object.keys(timings), data });
        } catch (error) {
            lastError = error?.message || 'network-or-cors-error';
            console.warn('AlAdhan fetch threw an error', { attempt: attempt.label, error });
        }
    }
    return { ...empty, error: lastError, date: dateStr };
}
// Validate a timezone supplied by the match feed without relying on a country list.
function resolveGroundTimezone(location, hint = '') {
    if (isValidIanaTimezone(location?.timezone)) return location.timezone;
    return isValidIanaTimezone(hint) ? hint : '';
}

function getDatePartsInTimezone(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
    return { year: values.year, month: values.month, day: values.day,
        iso: `${values.year}-${values.month}-${values.day}` };
}

function addOneIsoDay(isoDate) {
    const date = new Date(`${isoDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
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

function wakeUpBackend() {}
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

async function fetchMatches() {
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

        </div>
        <div id="matches-container"></div>`;
    
    if (!document.getElementById('tab-live')) { container.innerHTML = tabsHTML; } 
    else {
        let dash = container.querySelector('div[style*="border: 1px solid #334155"]');
        if(dash) dash.outerHTML = dashboardHTML;
    }

    let matchesContainer = document.getElementById("matches-container");
    matchesContainer.innerHTML = `<h3 style="color: #00ffcc; text-align: center;">🔄 Fetching Latest Data...</h3>`;

    let allMatches = [];

    try {
        const dataResponse = await fetch(`data/matches.json?ts=${Date.now()}`, { cache: "no-store" });
        if (!dataResponse.ok) throw new Error(`GitHub match snapshot unavailable: HTTP ${dataResponse.status}`);
        const snapshot = await dataResponse.json();
        allMatches = Array.isArray(snapshot.response?.items) ? snapshot.response.items : [];

        liveMatches = []; upcomingMatches = []; finishedMatches = [];
        const seen = new Set();
        const nowSeconds = Math.floor(Date.now() / 1000);

        allMatches.forEach(m => {
            if (!m?.teama?.name || !m?.teamb?.name) return;

            // Deduplicate before classification so a fixture can appear in one tab only.
            const fixtureKey = String(m.match_id || [m.timestamp_start, m.teama.name, m.teamb.name].join('|'));
            if (seen.has(fixtureKey)) return;
            seen.add(fixtureKey);

            const status = String(m.status_str || m.status_note || '').trim().toLowerCase();
            const startSeconds = Number(m.timestamp_start);
            const hasStartTime = Number.isFinite(startSeconds) && startSeconds > 0;

            // Terminal states take priority over live keywords (e.g. "innings completed").
            const isFinished = /\b(completed|complete|finished|finish|result|won|draw|tied|abandoned|abandon|cancelled|canceled)\b/.test(status);
            const isLive = /\b(live|in progress|progress|break|stumps|innings|in play|day [1-5]|lunch|tea|drinks|rain delay|bad light)\b/.test(status);
            const isScheduled = /\b(scheduled|upcoming|fixture|not started|yet to begin|match starts|toss)\b/.test(status);

            if (isFinished) {
                finishedMatches.push(m);
            } else if (isLive) {
                liveMatches.push(m);
            } else if (isScheduled && hasStartTime && startSeconds > nowSeconds) {
                // A scheduled fixture is Upcoming only while its start time is still in the future.
                upcomingMatches.push(m);
            }
            // Stale "Scheduled" records with a past start time, and unknown statuses,
            // are deliberately omitted instead of being incorrectly shown as Upcoming.
        });

        // Prediction eligibility follows the same visible, classified fixture set.
        const visibleMatches = [...liveMatches, ...upcomingMatches, ...finishedMatches];
        allowedPredictionMatchIds = new Set(visibleMatches.map(m => String(m.match_id || m.timestamp_start || '')));

        upcomingMatches.sort((a,b) => Number(a.timestamp_start) - Number(b.timestamp_start));
        finishedMatches.sort((a,b) => Number(b.timestamp_start) - Number(a.timestamp_start));
        switchTab(liveMatches.length ? 'live' : (upcomingMatches.length ? 'upcoming' : 'finished'));
        
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
        container.innerHTML = `<div style="text-align:center; color:#94a3b8; padding: 20px;">Is category mein filhal koi match nahi hai. Matches automatic update honge.</div>`;
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
        let permissionMatchId = String(m.match_id || m.timestamp_start || '');
        let competitionTitle = m.competition?.title || m.competition?.name || m.competition_name || m.league?.name || m.tournament?.name || '';
        let predictionAllowed = allowedPredictionMatchIds.has(permissionMatchId);
        
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
                <p style="color: #00ffcc; font-size: 0.8rem; margin: 0 0 5px 0;">${(competitionTitle || 'MATCH').toUpperCase()} | ${m.format_str || matchType}</p>
                <h4 style="color: #fff; margin: 0 0 5px 0;">${m.teama.name} vs ${m.teamb.name}</h4>
                <p style="color: #cbd5e1; font-size: 0.85rem; margin: 0 0 5px 0;">🏟️ ${m.venue?.name || 'Unknown'}</p>
                ${statusText}
                <p style="color: #64748b; font-size: 0.7rem; margin: 0 0 4px 0;">Match ID: ${permissionMatchId} | Competition: ${competitionTitle || 'Unknown'}</p>
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
                let competitionTitle = match.competition?.title || match.competition?.name || match.competition_name || match.league?.name || match.tournament?.name || '';
                
                const venueMeta = match.venue || {};
                const city = venueMeta.location || venueMeta.city || venueMeta.town || venueMeta.locality || "";
                const country = venueMeta.country || venueMeta.country_name || "";
                const venueTimezoneHint = venueMeta.timezone || venueMeta.time_zone || venueMeta.tz || "";
                const matchContext = {
                    team1: t1, team2: t2,
                    competition: competitionTitle,
                    format: match.format_str || matchType,
                    startTime: match.timestamp_start || ""
                };

                openPredictModal(t1, t2, safeVenue, matchType, matchId, match.timestamp_start, currentTab === 'live', city, country, competitionTitle, venueTimezoneHint, venueMeta, matchContext, match.ai_prediction || {});
            }
        });
    });
}

// ==========================================
// MAIN PREDICTION MODAL LOGIC
// ==========================================
async function openPredictModal(t1, t2, venue, type, matchId, startTime, isLiveMatch, city, country, competitionTitle = '', venueTimezoneHint = '', venueMeta = {}, matchContext = {}, predictionData = {}) {
    document.getElementById('prediction-modal').style.display = 'flex';
    document.getElementById('modal-match-name').innerText = `${t1} vs ${t2} (${type})`;
    document.getElementById('modal-venue').innerText = `🏟️ ${venue}`;
    document.getElementById('post-toss-area').style.display = 'none';
    document.getElementById('ilmi-area').style.display = 'none'; 
    window.ilmiTossBaseState = null;
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
        const pred = { success: Boolean(predictionData.pre), predictions: predictionData.pre || {}, is_default: Boolean(predictionData.is_default) };
        
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
    if (!isIlmiEligibleFixture(t1, t2, competitionTitle, type)) {
        ilmiDiv.innerHTML = '<div style="color:#fbbf24;">Ilmi Prediction sirf international matches aur Cricsheet-trained major franchise leagues ke liye available hai. Domestic matches is se excluded hain.</div>';
        return;
    }
    ilmiDiv.innerHTML = "Calculating Ilmi Insight...";

    const matchInstant = new Date(Number(startTime) * 1000);
    if (!Number.isFinite(matchInstant.getTime())) {
        ilmiDiv.innerHTML = '<div style="color:#fbbf24;">Match ka valid start time available nahi; Ilmi calculation roki gayi hai.</div>';
        return;
    }

    // Resolve this ground globally: prefer feed coordinates, otherwise geocode city/venue.
    const venueLocation = await resolveVenueLocation(city, country, venue, venueMeta, venueTimezoneHint, matchContext);
    const resolvedVenueTimezone = resolveGroundTimezone(venueLocation, venueTimezoneHint);
    if (!venueLocation || !resolvedVenueTimezone) {
        console.warn('Ilmi ground location/timezone resolution failed', { city, country, venue, venueMeta });
        ilmiDiv.innerHTML = '<div style="color:#fbbf24;">Is ground ki location/timezone verify nahi ho saki. Sahi local date aur Maghrib ke liye venue data zaroori hai.</div>';
        return;
    }
    console.info('Ilmi ground location resolved', { venue, city, country, ...venueLocation });
    const venueDateParts = getDatePartsInTimezone(matchInstant, resolvedVenueTimezone);
    const venueDateApi = `${venueDateParts.day}-${venueDateParts.month}-${venueDateParts.year}`;
    const maghribData = await fetchMaghribTime(venueLocation, venueDateApi);
    const maghribTime = maghribData.maghrib;
    if (!maghribTime) {
        console.error('Ilmi Maghrib verification failed', {
            venue, city, country, date: venueDateApi, coordinates: {
                latitude: venueLocation.latitude, longitude: venueLocation.longitude
            }, timezone: venueLocation.timezone, apiError: maghribData.error
        });
        ilmiDiv.innerHTML = '<div style="color:#fbbf24;">Venue ka Maghrib time verify nahi ho saka. API response ya network error ki tafseel browser console mein record kar di gayi hai. Ghalat date se bachne ke liye Ilmi calculation rok di gayi hai.</div>';
        return;
    }
    const nextIsoForPlanetary = addOneIsoDay(venueDateParts.iso);
    const [nextYearForPlanetary,nextMonthForPlanetary,nextDayForPlanetary] = nextIsoForPlanetary.split("-");
    const nextDayPrayerData = await fetchMaghribTime(venueLocation, `${nextDayForPlanetary}-${nextMonthForPlanetary}-${nextYearForPlanetary}`);
    if (!maghribData.sunrise || !maghribData.sunset || !nextDayPrayerData.sunrise) {
        ilmiDiv.innerHTML = '<div style="color:#fbbf24;">Planetary-hour calculation ke liye venue sunrise, sunset aur next sunrise verify nahi ho sake; Ilmi calculation roki gayi hai.</div>';
        return;
    }

    const matchTimeStr = matchInstant.toLocaleTimeString('en-GB', {
        timeZone: resolvedVenueTimezone, hour12: false, hour: '2-digit', minute: '2-digit'
    });
    const finalGregorianDate = matchTimeStr >= maghribTime
        ? addOneIsoDay(venueDateParts.iso)
        : venueDateParts.iso;
    const hijriReferenceDate = new Date(`${finalGregorianDate}T12:00:00Z`);

    // Use the Umm al-Qura calendar consistently. AlAdhan's default Hijri
    // conversion can differ by one day from Umm al-Qura; do not apply a
    // blanket API adjustment because that would shift unrelated dates too.
    const hijriFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
        timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric'
    });
    const hijriParts = hijriFormatter.formatToParts(hijriReferenceDate);
    const hijriDay = hijriParts.find(p => p.type === 'day')?.value;
    const hijriMonth = hijriParts.find(p => p.type === 'month')?.value;
    const hijriYear = hijriParts.find(p => p.type === 'year')?.value;
    if (!hijriDay || !hijriMonth || !hijriYear) {
        ilmiDiv.innerHTML = '<div style="color:#fbbf24;">Umm al-Qura Hijri date calculate nahi ho saki; Ilmi calculation rok di gayi hai.</div>';
        return;
    }
    const hijriDateStr = `${numberToUrdu(parseInt(hijriDay, 10))} ${urduMonths[parseInt(hijriMonth, 10) - 1]} ${numberToUrdu(parseInt(hijriYear.replace(' AH', '').replace(' BC', ''), 10))}`;

    // Civil weekday remains the venue-local match weekday. Hijri date advances
    // at Maghrib, but the Gregorian weekday does not advance until midnight.
    const [localYear, localMonth, localDay] = venueDateParts.iso.split("-").map(Number);
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

    const captainFor = name => {
        const exactName = String(name || "").trim();
        const normalizedName = normalizeIlmiName(exactName);
        const internationalKey = Object.keys(internationalCaptains)
            .find(key => normalizeIlmiName(key) === normalizedName);
        if (internationalKey) {
            // Never silently use a T20 captain for a Test or ODI fixture.
            return internationalCaptains[internationalKey][type] || "";
        }

        const franchiseKey = Object.keys(teamCaptains)
            .find(key => normalizeIlmiName(key) === normalizedName);
        if (franchiseKey) return teamCaptains[franchiseKey];

        // Never substitute a men's captain for a women's national side.
        return "";
    };
    capT1_Name = captainFor(t1);
    capT2_Name = captainFor(t2);
    const manualUrduCap1 = getIlmiCaptainOverride(t1), manualUrduCap2 = getIlmiCaptainOverride(t2);
    const directoryUrduCap1 = capT1_Name ? (urduCaptains[capT1_Name] || "") : "";
    const directoryUrduCap2 = capT2_Name ? (urduCaptains[capT2_Name] || "") : "";
    const urduCap1 = manualUrduCap1 || directoryUrduCap1;
    const urduCap2 = manualUrduCap2 || directoryUrduCap2;
    if (!urduCap1 || !urduCap2) {
        const missingCaptains = [!urduCap1 ? `${t1} (${type})` : "", !urduCap2 ? `${t2} (${type})` : ""].filter(Boolean);
        ilmiDiv.innerHTML = `<div style="color:#fbbf24;">${type} captain directory entry missing for: ${missingCaptains.join(", ")}. Agar aap ko sahi captain maloom hai to neeche Urdu mein enter karke save karein.</div>` + renderIlmiCaptainEditor(t1,t2,urduCap1,urduCap2);
    } else {

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

    // Save only the existing Ilmi baseline values; the entered toss-time factor is applied separately.
    window.ilmiTossBaseState = {
        team1: t1, team2: t2, baseA, baseB,
        teamAdadA: calculateAbjad(urduT1), teamAdadB: calculateAbjad(urduT2),
        captainAdadA: calculateAbjad(urduCap1), captainAdadB: calculateAbjad(urduCap2),
        contextMultA, contextMultB,
        matchTimeMultA: timeMultA, matchTimeMultB: timeMultB,
        sunrise: maghribData.sunrise, sunset: maghribData.sunset,
        nextSunrise: nextDayPrayerData.sunrise, matchStartTime: matchTimeStr,
        weekdayIndex: new Date(Date.UTC(...venueDateParts.iso.split("-").map((v,i)=>i===1?Number(v)-1:Number(v)))).getUTCDay()
    };

    let ilmiHtml = `
        <div style="margin-bottom: 10px; font-size: 12px; color: #cbd5e1;">
            🏏 Match Format: <strong style="color:#00ffcc;">${type}</strong><br>
            📅 <span class="urdu-text">${hijriDateStr}</span> | 🗓️ <span class="urdu-text">${dayUrdu}</span>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-bottom: 5px;">(Ground Time: ${matchTimeStr} | Maghrib: ${maghribTime})</div>
        <div style="margin:10px 0;padding:9px;border:1px solid #6b4b86;border-radius:7px;background:#120d1b;">
            <label for="ilmi-toss-time" style="display:block;color:#e9d5ff;font-size:12px;margin-bottom:5px;">Exact Toss Time (Venue Local — HH:MM)</label>
            <input id="ilmi-toss-time" type="time" style="width:100%;box-sizing:border-box;padding:8px;background:#0f172a;color:white;border:1px solid #475569;border-radius:5px;">
            <button id="apply-ilmi-toss-time" type="button" style="width:100%;padding:8px;margin-top:7px;background:#7e22ce;color:white;border:0;border-radius:5px;font-weight:bold;cursor:pointer;">Apply Final Ilmi Toss + Planetary Factors</button>
            <div id="ilmi-toss-result" style="margin-top:8px;"></div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
                <td style="color:#00ffcc; padding: 4px 0;">${t1} <br><span style="font-size:10px;color:#94a3b8;">(${urduCap1 || 'نام دستیاب نہیں'})</span></td>
                <td style="text-align:right; font-weight:bold; color:#00ffcc;">${finalA.toFixed(1)}</td>
            </tr>
            <tr>
                <td style="color:#ef4444; padding: 4px 0;">${t2} <br><span style="font-size:10px;color:#94a3b8;">(${urduCap2 || 'نام دستیاب نہیں'})</span></td>
                <td style="text-align:right; font-weight:bold; color:#ef4444;">${finalB.toFixed(1)}</td>
            </tr>
        </table>
        <div style="text-align: center; margin-top: 10px; color: #d946ef; font-weight: bold; font-size: 14px;">
            🌟 ${winnerText} Ka Pala Bhari Hai!
        </div>
    `;
    ilmiDiv.innerHTML = ilmiHtml + renderIlmiCaptainEditor(t1,t2,urduCap1,urduCap2);
    document.getElementById("apply-ilmi-toss-time")?.addEventListener("click", applyIlmiTossTimeFactor);
    }
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
            const tossSide = modelTw === modelT1 ? 't1' : 't2';
            const predictionKey = `${tossSide}_${td}`;
            const pred = { success: Boolean(predictionData.post_toss?.[predictionKey]), predictions: predictionData.post_toss?.[predictionKey] || {} };
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

document.addEventListener("DOMContentLoaded", () => { fetchMatches(); });
