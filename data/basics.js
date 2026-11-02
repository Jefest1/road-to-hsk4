// Foundations: the 214 Kangxi radicals (部首 bùshǒu), basic strokes, stroke-order rules and pinyin notes.
window.HSK = window.HSK || {};

// [radical, other forms, pinyin, meaning]. Order is the traditional one, by stroke count.
HSK.radicals = [
["一","","yī","one"],["丨","","gǔn","line"],["丶","","zhǔ","dot"],["丿","","piě","slash"],["乙","乚","yǐ","second; bent"],["亅","","jué","hook"],
["二","","èr","two"],["亠","","tóu","lid"],["人","亻","rén","person"],["儿","","ér","legs; child"],["入","","rù","enter"],["八","丷","bā","eight"],["冂","","jiōng","open box"],["冖","","mì","cover"],["冫","","bīng","ice"],["几","","jī","table"],["凵","","kǎn","open mouth; container"],["刀","刂","dāo","knife"],["力","","lì","power"],["勹","","bāo","wrap"],["匕","","bǐ","spoon"],["匚","","fāng","box"],["匸","","xǐ","hiding enclosure"],["十","","shí","ten"],["卜","","bǔ","divination"],["卩","","jié","seal"],["厂","","hàn","cliff"],["厶","","sī","private"],["又","","yòu","again; hand"],
["口","","kǒu","mouth"],["囗","","wéi","enclosure"],["土","","tǔ","earth"],["士","","shì","scholar"],["夂","","zhǐ","go"],["夊","","suī","go slowly"],["夕","","xī","evening"],["大","","dà","big"],["女","","nǚ","woman"],["子","","zǐ","child"],["宀","","mián","roof"],["寸","","cùn","inch"],["小","⺌","xiǎo","small"],["尢","","wāng","lame"],["尸","","shī","corpse"],["屮","","chè","sprout"],["山","","shān","mountain"],["巛","川","chuān","river"],["工","","gōng","work"],["己","","jǐ","oneself"],["巾","","jīn","cloth"],["干","","gān","dry; shield"],["幺","","yāo","tiny"],["广","","guǎng","shelter"],["廴","","yǐn","long stride"],["廾","","gǒng","two hands"],["弋","","yì","shoot"],["弓","","gōng","bow"],["彐","⺕","jì","snout"],["彡","","shān","hair; bristle"],["彳","","chì","step"],
["心","忄","xīn","heart"],["戈","","gē","spear"],["戶","户","hù","door"],["手","扌","shǒu","hand"],["支","","zhī","branch"],["攴","攵","pū","knock; strike"],["文","","wén","writing"],["斗","","dǒu","dipper"],["斤","","jīn","axe"],["方","","fāng","square"],["无","","wú","not; none"],["日","","rì","sun"],["曰","","yuē","say"],["月","","yuè","moon; flesh"],["木","","mù","tree; wood"],["欠","","qiàn","yawn; lack"],["止","","zhǐ","stop"],["歹","","dǎi","bad; death"],["殳","","shū","weapon"],["毋","","wú","do not"],["比","","bǐ","compare"],["毛","","máo","fur"],["氏","","shì","clan"],["气","","qì","air; steam"],["水","氵","shuǐ","water"],["火","灬","huǒ","fire"],["爪","爫","zhǎo","claw"],["父","","fù","father"],["爻","","yáo","lines of a hexagram"],["爿","丬","qiáng","split wood"],["片","","piàn","slice"],["牙","","yá","tooth"],["牛","牜","niú","cow"],["犬","犭","quǎn","dog"],
["玄","","xuán","dark; profound"],["玉","王","yù","jade"],["瓜","","guā","melon"],["瓦","","wǎ","tile"],["甘","","gān","sweet"],["生","","shēng","life"],["用","","yòng","use"],["田","","tián","field"],["疋","","pǐ","bolt of cloth"],["疒","","nè","sickness"],["癶","","bō","footsteps"],["白","","bái","white"],["皮","","pí","skin"],["皿","","mǐn","dish"],["目","","mù","eye"],["矛","","máo","spear"],["矢","","shǐ","arrow"],["石","","shí","stone"],["示","礻","shì","spirit; show"],["禸","","róu","track"],["禾","","hé","grain"],["穴","","xué","cave"],["立","","lì","stand"],
["竹","⺮","zhú","bamboo"],["米","","mǐ","rice"],["糸","纟","mì","silk"],["缶","","fǒu","jar"],["网","罒","wǎng","net"],["羊","","yáng","sheep"],["羽","","yǔ","feather"],["老","耂","lǎo","old"],["而","","ér","and; beard"],["耒","","lěi","plow"],["耳","","ěr","ear"],["聿","","yù","brush"],["肉","月","ròu","meat"],["臣","","chén","minister"],["自","","zì","self"],["至","","zhì","arrive"],["臼","","jiù","mortar"],["舌","","shé","tongue"],["舛","","chuǎn","oppose"],["舟","","zhōu","boat"],["艮","","gèn","stopping"],["色","","sè","color"],["艸","艹","cǎo","grass"],["虍","","hū","tiger"],["虫","","chóng","insect"],["血","","xuè","blood"],["行","","xíng","walk"],["衣","衤","yī","clothes"],["襾","西","yà","cover; west"],
["見","见","jiàn","see"],["角","","jiǎo","horn"],["言","讠","yán","speech"],["谷","","gǔ","valley"],["豆","","dòu","bean"],["豕","","shǐ","pig"],["豸","","zhì","cat; badger"],["貝","贝","bèi","shell; money"],["赤","","chì","red"],["走","","zǒu","walk"],["足","","zú","foot"],["身","","shēn","body"],["車","车","chē","cart"],["辛","","xīn","bitter"],["辰","","chén","morning"],["辵","辶","chuò","walk"],["邑","阝","yì","city (right side)"],["酉","","yǒu","wine"],["釆","","biàn","distinguish"],["里","","lǐ","village"],
["金","钅","jīn","gold; metal"],["長","长","cháng","long"],["門","门","mén","gate"],["阜","阝","fù","mound (left side)"],["隶","","lì","slave"],["隹","","zhuī","short-tailed bird"],["雨","","yǔ","rain"],["青","","qīng","blue-green"],["非","","fēi","wrong; not"],
["面","","miàn","face"],["革","","gé","leather"],["韋","韦","wéi","soft leather"],["韭","","jiǔ","leek"],["音","","yīn","sound"],["頁","页","yè","page; head"],["風","风","fēng","wind"],["飛","飞","fēi","fly"],["食","饣","shí","food"],["首","","shǒu","head"],["香","","xiāng","fragrant"],
["馬","马","mǎ","horse"],["骨","","gǔ","bone"],["高","","gāo","tall"],["髟","","biāo","hair"],["鬥","","dòu","fight"],["鬯","","chàng","sacrificial wine"],["鬲","","lì","cauldron"],["鬼","","guǐ","ghost"],
["魚","鱼","yú","fish"],["鳥","鸟","niǎo","bird"],["鹵","卤","lǔ","salt"],["鹿","","lù","deer"],["麥","麦","mài","wheat"],["麻","","má","hemp"],
["黃","黄","huáng","yellow"],["黍","","shǔ","millet"],["黑","","hēi","black"],["黹","","zhǐ","embroidery"],
["黽","黾","mǐn","frog"],["鼎","","dǐng","tripod"],["鼓","","gǔ","drum"],["鼠","","shǔ","rat"],
["鼻","","bí","nose"],["齊","齐","qí","even"],
["齒","齿","chǐ","teeth"],
["龍","龙","lóng","dragon"],["龜","龟","guī","turtle"],
["龠","","yuè","flute"]
];
HSK.radicalStrokes = [[1,6],[2,23],[3,31],[4,34],[5,23],[6,29],[7,20],[8,9],[9,11],[10,8],[11,6],[12,4],[13,4],[14,2],[15,1],[16,2],[17,1]];

// The radicals that come up most often in everyday characters; shown first.
HSK.commonRadicals = "人口女子宀心手水火日月木土艸言金門辵糸竹食車馬魚目足刀力又田衣示禾米山石雨犬";

// The basic strokes. [name, pinyin, English, a simple character that shows it]
HSK.strokes = [
["横","héng","horizontal, left to right","一"],
["竖","shù","vertical, top to bottom","中"],
["撇","piě","falling to the left","八"],
["捺","nà","falling to the right, thickening at the end","人"],
["点","diǎn","dot","六"],
["提","tí","rising, bottom left to top right","打"],
["折","zhé","turn: changes direction without lifting the pen","口"],
["钩","gōu","hook: a small flick at the end of a stroke","小"]
];
HSK.strokeRules = [
["Top before bottom","三"],
["Left before right","你"],
["Horizontal before vertical when they cross","十"],
["Falling-left before falling-right","人"],
["Outside before inside","月"],
["Inside before closing the bottom of a box","国"],
["Middle before the two sides","小"]
];

// Sounds that trip up English speakers.
HSK.pinyinTips = [
["q","Like \"ch\" in cheese, but with the tongue tip down behind the lower teeth.","七"],
["x","Like \"sh\" in sheep, tongue tip down, smiling.","西"],
["j","Like \"j\" in jeep, tongue tip down.","几"],
["zh","Like \"j\" in judge, tongue curled back.","中"],
["ch","Like \"ch\" in church, tongue curled back.","吃"],
["sh","Like \"sh\" in shirt, tongue curled back.","是"],
["r","Between \"r\" in run and \"s\" in measure, tongue curled back.","人"],
["z","Like \"ds\" in kids.","字"],
["c","Like \"ts\" in cats, with a puff of air.","菜"],
["ü","Say \"ee\" and round your lips without moving your tongue. After j, q, x, y it is written as u.","女"],
["i after z, c, s","Not \"ee\". A buzz held on the consonant: zi, ci, si.","四"],
["i after zh, ch, sh, r","Not \"ee\". A buzz with the tongue curled back: zhi, chi, shi, ri.","十"],
["e","Like \"uh\" from the back of the throat, not like \"e\" in bed.","喝"],
["b / p","Both are voiceless. p has a puff of air and b does not. The same goes for d/t, g/k, j/q, zh/ch and z/c.","八"]
];
