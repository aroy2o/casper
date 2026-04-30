export interface District {
  name: string;
  code: string;
}

export interface StateInfo {
  name: string;
  code: string;
  type: "state" | "ut";
  regionMultiplier: number;
  districts: District[];
}

export const INDIA_GEO: StateInfo[] = [
  {
    name: "Andhra Pradesh", code: "AP", type: "state", regionMultiplier: 1.02,
    districts: [
      { name: "Visakhapatnam", code: "AP-VZM" }, { name: "Vijayawada", code: "AP-VJA" },
      { name: "Guntur", code: "AP-GNT" }, { name: "Tirupati", code: "AP-TRP" },
      { name: "Kurnool", code: "AP-KNL" }, { name: "Nellore", code: "AP-NLR" },
      { name: "Rajahmundry", code: "AP-RJY" }, { name: "Kakinada", code: "AP-KKD" },
      { name: "Srikakulam", code: "AP-SKL" }, { name: "Chittoor", code: "AP-CTR" },
      { name: "Anantapur", code: "AP-ATP" }, { name: "Kadapa", code: "AP-KDP" },
      { name: "Eluru", code: "AP-ELR" }
    ]
  },
  {
    name: "Arunachal Pradesh", code: "AR", type: "state", regionMultiplier: 1.18,
    districts: [
      { name: "Itanagar", code: "AR-ITA" }, { name: "Naharlagun", code: "AR-NHL" },
      { name: "Pasighat", code: "AR-PSG" }, { name: "Tezpur", code: "AR-TZP" },
      { name: "Tawang", code: "AR-TWG" }, { name: "Bomdila", code: "AR-BML" },
      { name: "Ziro", code: "AR-ZRO" }, { name: "Along", code: "AR-ALG" },
      { name: "Tezu", code: "AR-TZU" }, { name: "Changlang", code: "AR-CHL" },
      { name: "Tirap", code: "AR-TRP" }, { name: "Longding", code: "AR-LDG" }
    ]
  },
  {
    name: "Assam", code: "AS", type: "state", regionMultiplier: 1.08,
    districts: [
      { name: "Guwahati", code: "AS-GUW" }, { name: "Dibrugarh", code: "AS-DBR" },
      { name: "Silchar", code: "AS-SLC" }, { name: "Jorhat", code: "AS-JHT" },
      { name: "Nagaon", code: "AS-NGN" }, { name: "Tinsukia", code: "AS-TNS" },
      { name: "Tezpur", code: "AS-TZP" }, { name: "Dhubri", code: "AS-DHB" },
      { name: "Bongaigaon", code: "AS-BNG" }, { name: "Lakhimpur", code: "AS-LKP" },
      { name: "Barpeta", code: "AS-BRP" }, { name: "Karimganj", code: "AS-KMJ" },
      { name: "Hailakandi", code: "AS-HLK" }, { name: "Goalpara", code: "AS-GLP" }
    ]
  },
  {
    name: "Bihar", code: "BR", type: "state", regionMultiplier: 1.03,
    districts: [
      { name: "Patna", code: "BR-PAT" }, { name: "Gaya", code: "BR-GAY" },
      { name: "Muzaffarpur", code: "BR-MZF" }, { name: "Bhagalpur", code: "BR-BGL" },
      { name: "Darbhanga", code: "BR-DBG" }, { name: "Purnia", code: "BR-PRN" },
      { name: "Arrah", code: "BR-ARH" }, { name: "Begusarai", code: "BR-BGS" },
      { name: "Katihar", code: "BR-KTH" }, { name: "Munger", code: "BR-MNG" },
      { name: "Chapra", code: "BR-CPR" }, { name: "Sitamarhi", code: "BR-STM" },
      { name: "Vaishali", code: "BR-VSH" }, { name: "Madhubani", code: "BR-MDH" },
      { name: "Samastipur", code: "BR-SMS" }, { name: "Hajipur", code: "BR-HJP" }
    ]
  },
  {
    name: "Chhattisgarh", code: "CT", type: "state", regionMultiplier: 1.05,
    districts: [
      { name: "Raipur", code: "CT-RPR" }, { name: "Bilaspur", code: "CT-BLP" },
      { name: "Durg", code: "CT-DRG" }, { name: "Bhilai", code: "CT-BHI" },
      { name: "Korba", code: "CT-KRB" }, { name: "Rajnandgaon", code: "CT-RJN" },
      { name: "Jagdalpur", code: "CT-JGD" }, { name: "Ambikapur", code: "CT-AMB" },
      { name: "Raigarh", code: "CT-RGH" }, { name: "Janjgir", code: "CT-JJG" }
    ]
  },
  {
    name: "Goa", code: "GA", type: "state", regionMultiplier: 1.12,
    districts: [
      { name: "Panaji", code: "GA-PNJ" }, { name: "Margao", code: "GA-MGO" },
      { name: "Vasco", code: "GA-VSC" }, { name: "Mapusa", code: "GA-MPS" },
      { name: "Ponda", code: "GA-PND" }, { name: "Bicholim", code: "GA-BCH" }
    ]
  },
  {
    name: "Gujarat", code: "GJ", type: "state", regionMultiplier: 1.04,
    districts: [
      { name: "Ahmedabad", code: "GJ-AMD" }, { name: "Surat", code: "GJ-SRT" },
      { name: "Vadodara", code: "GJ-VDR" }, { name: "Rajkot", code: "GJ-RJK" },
      { name: "Bhavnagar", code: "GJ-BVN" }, { name: "Jamnagar", code: "GJ-JMN" },
      { name: "Junagadh", code: "GJ-JNG" }, { name: "Gandhinagar", code: "GJ-GND" },
      { name: "Anand", code: "GJ-AND" }, { name: "Mehsana", code: "GJ-MHS" },
      { name: "Kutch", code: "GJ-KTC" }, { name: "Bharuch", code: "GJ-BRC" },
      { name: "Nadiad", code: "GJ-NDI" }, { name: "Navsari", code: "GJ-NVS" }
    ]
  },
  {
    name: "Haryana", code: "HR", type: "state", regionMultiplier: 1.05,
    districts: [
      { name: "Gurugram", code: "HR-GGN" }, { name: "Faridabad", code: "HR-FBD" },
      { name: "Ambala", code: "HR-AMB" }, { name: "Rohtak", code: "HR-RHT" },
      { name: "Hisar", code: "HR-HSR" }, { name: "Karnal", code: "HR-KNL" },
      { name: "Panipat", code: "HR-PNP" }, { name: "Sonipat", code: "HR-SNP" },
      { name: "Yamunanagar", code: "HR-YNR" }, { name: "Jhajjar", code: "HR-JJR" },
      { name: "Kurukshetra", code: "HR-KKR" }, { name: "Bhiwani", code: "HR-BWN" }
    ]
  },
  {
    name: "Himachal Pradesh", code: "HP", type: "state", regionMultiplier: 1.13,
    districts: [
      { name: "Shimla", code: "HP-SML" }, { name: "Dharamshala", code: "HP-DHR" },
      { name: "Mandi", code: "HP-MND" }, { name: "Solan", code: "HP-SLN" },
      { name: "Kullu", code: "HP-KLU" }, { name: "Hamirpur", code: "HP-HMP" },
      { name: "Una", code: "HP-UNA" }, { name: "Bilaspur", code: "HP-BLP" },
      { name: "Kangra", code: "HP-KNG" }, { name: "Lahaul Spiti", code: "HP-LHS" },
      { name: "Kinnaur", code: "HP-KNR" }, { name: "Sirmaur", code: "HP-SRM" }
    ]
  },
  {
    name: "Jharkhand", code: "JH", type: "state", regionMultiplier: 1.06,
    districts: [
      { name: "Ranchi", code: "JH-RNC" }, { name: "Jamshedpur", code: "JH-JMS" },
      { name: "Dhanbad", code: "JH-DHN" }, { name: "Bokaro", code: "JH-BKR" },
      { name: "Deoghar", code: "JH-DGH" }, { name: "Hazaribagh", code: "JH-HZB" },
      { name: "Giridih", code: "JH-GRD" }, { name: "Ramgarh", code: "JH-RMG" },
      { name: "Dumka", code: "JH-DMK" }, { name: "Palamu", code: "JH-PLM" }
    ]
  },
  {
    name: "Karnataka", code: "KA", type: "state", regionMultiplier: 1.07,
    districts: [
      { name: "Bengaluru Urban", code: "KA-BNG" }, { name: "Mysuru", code: "KA-MYS" },
      { name: "Hubballi-Dharwad", code: "KA-HBL" }, { name: "Mangaluru", code: "KA-MNG" },
      { name: "Belagavi", code: "KA-BLG" }, { name: "Davanagere", code: "KA-DVG" },
      { name: "Ballari", code: "KA-BLR" }, { name: "Vijayapura", code: "KA-VJP" },
      { name: "Shivamogga", code: "KA-SMG" }, { name: "Tumakuru", code: "KA-TMK" },
      { name: "Raichur", code: "KA-RCH" }, { name: "Bidar", code: "KA-BDR" },
      { name: "Kalaburagi", code: "KA-KLB" }, { name: "Hassan", code: "KA-HSN" }
    ]
  },
  {
    name: "Kerala", code: "KL", type: "state", regionMultiplier: 1.09,
    districts: [
      { name: "Thiruvananthapuram", code: "KL-TVM" }, { name: "Kochi", code: "KL-KCH" },
      { name: "Kozhikode", code: "KL-KZK" }, { name: "Thrissur", code: "KL-TCR" },
      { name: "Kollam", code: "KL-KLM" }, { name: "Kannur", code: "KL-KNR" },
      { name: "Palakkad", code: "KL-PKD" }, { name: "Malappuram", code: "KL-MLP" },
      { name: "Alappuzha", code: "KL-ALP" }, { name: "Kottayam", code: "KL-KTM" },
      { name: "Idukki", code: "KL-IDK" }, { name: "Wayanad", code: "KL-WYD" },
      { name: "Kasargod", code: "KL-KSD" }, { name: "Pathanamthitta", code: "KL-PTN" }
    ]
  },
  {
    name: "Madhya Pradesh", code: "MP", type: "state", regionMultiplier: 1.03,
    districts: [
      { name: "Bhopal", code: "MP-BHO" }, { name: "Indore", code: "MP-IND" },
      { name: "Gwalior", code: "MP-GWL" }, { name: "Jabalpur", code: "MP-JBP" },
      { name: "Ujjain", code: "MP-UJN" }, { name: "Sagar", code: "MP-SGR" },
      { name: "Rewa", code: "MP-REW" }, { name: "Satna", code: "MP-STN" },
      { name: "Ratlam", code: "MP-RTM" }, { name: "Dewas", code: "MP-DWS" },
      { name: "Chhindwara", code: "MP-CHW" }, { name: "Shivpuri", code: "MP-SHP" },
      { name: "Vidisha", code: "MP-VDS" }, { name: "Morena", code: "MP-MRN" }
    ]
  },
  {
    name: "Maharashtra", code: "MH", type: "state", regionMultiplier: 1.1,
    districts: [
      { name: "Mumbai", code: "MH-MUM" }, { name: "Pune", code: "MH-PUN" },
      { name: "Nagpur", code: "MH-NGP" }, { name: "Nashik", code: "MH-NSK" },
      { name: "Aurangabad", code: "MH-AUR" }, { name: "Solapur", code: "MH-SLP" },
      { name: "Amravati", code: "MH-AMT" }, { name: "Kolhapur", code: "MH-KLP" },
      { name: "Sangli", code: "MH-SGL" }, { name: "Satara", code: "MH-STR" },
      { name: "Ratnagiri", code: "MH-RTG" }, { name: "Thane", code: "MH-THN" },
      { name: "Nanded", code: "MH-NND" }, { name: "Latur", code: "MH-LTR" },
      { name: "Akola", code: "MH-AKL" }, { name: "Yavatmal", code: "MH-YVT" }
    ]
  },
  {
    name: "Manipur", code: "MN", type: "state", regionMultiplier: 1.12,
    districts: [
      { name: "Imphal West", code: "MN-IWS" }, { name: "Imphal East", code: "MN-IES" },
      { name: "Thoubal", code: "MN-TBL" }, { name: "Bishnupur", code: "MN-BSP" },
      { name: "Churachandpur", code: "MN-CCP" }, { name: "Senapati", code: "MN-SNP" },
      { name: "Ukhrul", code: "MN-UKL" }, { name: "Chandel", code: "MN-CDL" },
      { name: "Tamenglong", code: "MN-TML" }, { name: "Jiribam", code: "MN-JBM" }
    ]
  },
  {
    name: "Meghalaya", code: "ML", type: "state", regionMultiplier: 1.1,
    districts: [
      { name: "Shillong", code: "ML-SHL" }, { name: "Tura", code: "ML-TRA" },
      { name: "Jowai", code: "ML-JWI" }, { name: "Nongstoin", code: "ML-NGS" },
      { name: "Baghmara", code: "ML-BGM" }, { name: "Williamnagar", code: "ML-WLN" },
      { name: "Resubelpara", code: "ML-RSB" }, { name: "Mawkyrwat", code: "ML-MWT" },
      { name: "Ampati", code: "ML-AMP" }, { name: "Mairang", code: "ML-MRG" },
      { name: "Khliehriat", code: "ML-KLH" }, { name: "Nongpoh", code: "ML-NPH" }
    ]
  },
  {
    name: "Mizoram", code: "MZ", type: "state", regionMultiplier: 1.16,
    districts: [
      { name: "Aizawl", code: "MZ-AIZ" }, { name: "Lunglei", code: "MZ-LGL" },
      { name: "Champhai", code: "MZ-CHP" }, { name: "Serchhip", code: "MZ-SRC" },
      { name: "Kolasib", code: "MZ-KLS" }, { name: "Mamit", code: "MZ-MMT" },
      { name: "Lawngtlai", code: "MZ-LWT" }, { name: "Saiha", code: "MZ-SAI" }
    ]
  },
  {
    name: "Nagaland", code: "NL", type: "state", regionMultiplier: 1.14,
    districts: [
      { name: "Kohima", code: "NL-KHM" }, { name: "Dimapur", code: "NL-DMP" },
      { name: "Mokokchung", code: "NL-MKC" }, { name: "Tuensang", code: "NL-TNS" },
      { name: "Wokha", code: "NL-WKH" }, { name: "Zunheboto", code: "NL-ZNH" },
      { name: "Mon", code: "NL-MON" }, { name: "Phek", code: "NL-PHK" },
      { name: "Longleng", code: "NL-LNG" }, { name: "Kiphire", code: "NL-KPH" },
      { name: "Peren", code: "NL-PRN" }
    ]
  },
  {
    name: "Odisha", code: "OD", type: "state", regionMultiplier: 1.04,
    districts: [
      { name: "Bhubaneswar", code: "OD-BBS" }, { name: "Cuttack", code: "OD-CTC" },
      { name: "Rourkela", code: "OD-RKL" }, { name: "Berhampur", code: "OD-BAM" },
      { name: "Sambalpur", code: "OD-SBP" }, { name: "Puri", code: "OD-PRI" },
      { name: "Balasore", code: "OD-BLS" }, { name: "Baripada", code: "OD-BRP" },
      { name: "Bhadrak", code: "OD-BDK" }, { name: "Koraput", code: "OD-KPT" },
      { name: "Sundargarh", code: "OD-SNG" }, { name: "Jharsuguda", code: "OD-JSG" },
      { name: "Kendujhar", code: "OD-KJR" }, { name: "Angul", code: "OD-AGL" }
    ]
  },
  {
    name: "Punjab", code: "PB", type: "state", regionMultiplier: 1.06,
    districts: [
      { name: "Ludhiana", code: "PB-LDH" }, { name: "Amritsar", code: "PB-ASR" },
      { name: "Jalandhar", code: "PB-JLN" }, { name: "Patiala", code: "PB-PTL" },
      { name: "Bathinda", code: "PB-BTI" }, { name: "Mohali", code: "PB-SAS" },
      { name: "Gurdaspur", code: "PB-GDP" }, { name: "Hoshiarpur", code: "PB-HSP" },
      { name: "Firozpur", code: "PB-FZR" }, { name: "Sangrur", code: "PB-SGR" },
      { name: "Fatehgarh Sahib", code: "PB-FGS" }, { name: "Moga", code: "PB-MGA" },
      { name: "Rupnagar", code: "PB-RPN" }, { name: "Faridkot", code: "PB-FKT" }
    ]
  },
  {
    name: "Rajasthan", code: "RJ", type: "state", regionMultiplier: 1.02,
    districts: [
      { name: "Jaipur", code: "RJ-JPR" }, { name: "Jodhpur", code: "RJ-JDH" },
      { name: "Kota", code: "RJ-KOT" }, { name: "Bikaner", code: "RJ-BKN" },
      { name: "Udaipur", code: "RJ-UDP" }, { name: "Ajmer", code: "RJ-AJM" },
      { name: "Bhilwara", code: "RJ-BHW" }, { name: "Alwar", code: "RJ-ALW" },
      { name: "Sikar", code: "RJ-SKR" }, { name: "Pali", code: "RJ-PAL" },
      { name: "Bharatpur", code: "RJ-BTP" }, { name: "Sri Ganganagar", code: "RJ-SNG" },
      { name: "Nagaur", code: "RJ-NGR" }, { name: "Tonk", code: "RJ-TNK" },
      { name: "Barmer", code: "RJ-BRM" }, { name: "Churu", code: "RJ-CHR" }
    ]
  },
  {
    name: "Sikkim", code: "SK", type: "state", regionMultiplier: 1.15,
    districts: [
      { name: "Gangtok", code: "SK-GTK" }, { name: "Namchi", code: "SK-NMC" },
      { name: "Gyalshing", code: "SK-GYL" }, { name: "Mangan", code: "SK-MNG" },
      { name: "Rangpo", code: "SK-RGP" }, { name: "Singtam", code: "SK-SGT" }
    ]
  },
  {
    name: "Tamil Nadu", code: "TN", type: "state", regionMultiplier: 1.07,
    districts: [
      { name: "Chennai", code: "TN-CHN" }, { name: "Coimbatore", code: "TN-CBE" },
      { name: "Madurai", code: "TN-MDU" }, { name: "Tiruchirappalli", code: "TN-TRZ" },
      { name: "Salem", code: "TN-SLM" }, { name: "Tirunelveli", code: "TN-TEN" },
      { name: "Tiruppur", code: "TN-TUP" }, { name: "Erode", code: "TN-ERD" },
      { name: "Vellore", code: "TN-VLR" }, { name: "Thoothukudi", code: "TN-TUT" },
      { name: "Dindigul", code: "TN-DGL" }, { name: "Thanjavur", code: "TN-TNJ" },
      { name: "Kancheepuram", code: "TN-KCM" }, { name: "Cuddalore", code: "TN-CDL" },
      { name: "Namakkal", code: "TN-NMK" }, { name: "Karur", code: "TN-KRR" }
    ]
  },
  {
    name: "Telangana", code: "TG", type: "state", regionMultiplier: 1.06,
    districts: [
      { name: "Hyderabad", code: "TG-HYD" }, { name: "Warangal", code: "TG-WGL" },
      { name: "Nizamabad", code: "TG-NZB" }, { name: "Karimnagar", code: "TG-KMN" },
      { name: "Khammam", code: "TG-KHM" }, { name: "Ramagundam", code: "TG-RGD" },
      { name: "Mahbubnagar", code: "TG-MBN" }, { name: "Nalgonda", code: "TG-NLG" },
      { name: "Adilabad", code: "TG-ADB" }, { name: "Siddipet", code: "TG-SDP" },
      { name: "Suryapet", code: "TG-SYP" }, { name: "Rangareddy", code: "TG-RRD" }
    ]
  },
  {
    name: "Tripura", code: "TR", type: "state", regionMultiplier: 1.11,
    districts: [
      { name: "Agartala", code: "TR-AGT" }, { name: "Udaipur", code: "TR-UDP" },
      { name: "Dharmanagar", code: "TR-DHM" }, { name: "Sabroom", code: "TR-SBR" },
      { name: "Belonia", code: "TR-BLN" }, { name: "Ambassa", code: "TR-AMS" },
      { name: "Khowai", code: "TR-KWI" }, { name: "Kailashahar", code: "TR-KLH" }
    ]
  },
  {
    name: "Uttar Pradesh", code: "UP", type: "state", regionMultiplier: 1.0,
    districts: [
      { name: "Lucknow", code: "UP-LKO" }, { name: "Kanpur", code: "UP-KNP" },
      { name: "Agra", code: "UP-AGR" }, { name: "Varanasi", code: "UP-VNS" },
      { name: "Prayagraj", code: "UP-ALD" }, { name: "Meerut", code: "UP-MRT" },
      { name: "Ghaziabad", code: "UP-GZB" }, { name: "Noida", code: "UP-GBN" },
      { name: "Mathura", code: "UP-MTH" }, { name: "Bareilly", code: "UP-BRL" },
      { name: "Aligarh", code: "UP-ALG" }, { name: "Moradabad", code: "UP-MRD" },
      { name: "Saharanpur", code: "UP-SHN" }, { name: "Gorakhpur", code: "UP-GKP" },
      { name: "Faizabad", code: "UP-FZD" }, { name: "Jhansi", code: "UP-JHS" },
      { name: "Muzaffarnagar", code: "UP-MFN" }, { name: "Gonda", code: "UP-GND" }
    ]
  },
  {
    name: "Uttarakhand", code: "UK", type: "state", regionMultiplier: 1.12,
    districts: [
      { name: "Dehradun", code: "UK-DDN" }, { name: "Haridwar", code: "UK-HRW" },
      { name: "Nainital", code: "UK-NNT" }, { name: "Udham Singh Nagar", code: "UK-USN" },
      { name: "Almora", code: "UK-ALM" }, { name: "Pauri Garhwal", code: "UK-PGW" },
      { name: "Pithoragarh", code: "UK-PTG" }, { name: "Tehri Garhwal", code: "UK-TGW" },
      { name: "Chamoli", code: "UK-CML" }, { name: "Uttarkashi", code: "UK-UKS" },
      { name: "Bageshwar", code: "UK-BGS" }, { name: "Champawat", code: "UK-CPW" },
      { name: "Rudraprayag", code: "UK-RDP" }
    ]
  },
  {
    name: "West Bengal", code: "WB", type: "state", regionMultiplier: 1.05,
    districts: [
      { name: "Kolkata", code: "WB-KOL" }, { name: "Howrah", code: "WB-HWH" },
      { name: "Asansol", code: "WB-ASN" }, { name: "Siliguri", code: "WB-SLG" },
      { name: "Durgapur", code: "WB-DGP" }, { name: "Bardhaman", code: "WB-BRD" },
      { name: "Malda", code: "WB-MLD" }, { name: "Murshidabad", code: "WB-MSD" },
      { name: "Nadia", code: "WB-NDI" }, { name: "North 24 Parganas", code: "WB-N24" },
      { name: "South 24 Parganas", code: "WB-S24" }, { name: "Hooghly", code: "WB-HGL" },
      { name: "Jalpaiguri", code: "WB-JPG" }, { name: "Darjeeling", code: "WB-DJL" },
      { name: "Cooch Behar", code: "WB-COB" }, { name: "Purulia", code: "WB-PRL" }
    ]
  },
  // Union Territories
  {
    name: "Andaman and Nicobar Islands", code: "AN", type: "ut", regionMultiplier: 1.25,
    districts: [
      { name: "Port Blair", code: "AN-PTB" }, { name: "North and Middle Andaman", code: "AN-NMA" },
      { name: "South Andaman", code: "AN-SAN" }, { name: "Nicobars", code: "AN-NCB" }
    ]
  },
  {
    name: "Chandigarh", code: "CH", type: "ut", regionMultiplier: 1.08,
    districts: [
      { name: "Chandigarh", code: "CH-CHD" }
    ]
  },
  {
    name: "Dadra and Nagar Haveli and Daman and Diu", code: "DN", type: "ut", regionMultiplier: 1.06,
    districts: [
      { name: "Daman", code: "DN-DMN" }, { name: "Diu", code: "DN-DIU" },
      { name: "Dadra and Nagar Haveli", code: "DN-DNH" }
    ]
  },
  {
    name: "Delhi", code: "DL", type: "ut", regionMultiplier: 1.14,
    districts: [
      { name: "Central Delhi", code: "DL-CDL" }, { name: "East Delhi", code: "DL-EDL" },
      { name: "New Delhi", code: "DL-NDL" }, { name: "North Delhi", code: "DL-NDH" },
      { name: "North East Delhi", code: "DL-NED" }, { name: "North West Delhi", code: "DL-NWD" },
      { name: "Shahdara", code: "DL-SHD" }, { name: "South Delhi", code: "DL-SDL" },
      { name: "South East Delhi", code: "DL-SED" }, { name: "South West Delhi", code: "DL-SWD" },
      { name: "West Delhi", code: "DL-WDL" }
    ]
  },
  {
    name: "Jammu and Kashmir", code: "JK", type: "ut", regionMultiplier: 1.13,
    districts: [
      { name: "Srinagar", code: "JK-SRG" }, { name: "Jammu", code: "JK-JMU" },
      { name: "Anantnag", code: "JK-ANN" }, { name: "Baramulla", code: "JK-BRM" },
      { name: "Sopore", code: "JK-SPR" }, { name: "Kathua", code: "JK-KTH" },
      { name: "Udhampur", code: "JK-UDP" }, { name: "Rajouri", code: "JK-RJR" },
      { name: "Pulwama", code: "JK-PLW" }, { name: "Kupwara", code: "JK-KPW" },
      { name: "Poonch", code: "JK-PCH" }, { name: "Doda", code: "JK-DDA" }
    ]
  },
  {
    name: "Ladakh", code: "LA", type: "ut", regionMultiplier: 1.28,
    districts: [
      { name: "Leh", code: "LA-LEH" }, { name: "Kargil", code: "LA-KGL" }
    ]
  },
  {
    name: "Lakshadweep", code: "LD", type: "ut", regionMultiplier: 1.3,
    districts: [
      { name: "Kavaratti", code: "LD-KVT" }, { name: "Agatti", code: "LD-AGT" },
      { name: "Amini", code: "LD-AMN" }
    ]
  },
  {
    name: "Puducherry", code: "PY", type: "ut", regionMultiplier: 1.05,
    districts: [
      { name: "Puducherry", code: "PY-PDC" }, { name: "Karaikal", code: "PY-KKL" },
      { name: "Mahe", code: "PY-MAH" }, { name: "Yanam", code: "PY-YNM" }
    ]
  }
];

export const STATE_MAP = new Map<string, StateInfo>(
  INDIA_GEO.map((s) => [s.code, s])
);

export const STATE_NAME_MAP = new Map<string, StateInfo>(
  INDIA_GEO.map((s) => [s.name.toLowerCase(), s])
);

export const ALL_STATE_CODES = INDIA_GEO.map((s) => s.code);
export const ALL_STATE_NAMES = INDIA_GEO.map((s) => s.name);

export function getStateByName(name: string): StateInfo | undefined {
  return STATE_NAME_MAP.get(name.toLowerCase());
}

export function getDistrictsByState(stateCode: string): District[] {
  return STATE_MAP.get(stateCode)?.districts ?? [];
}

export function getRegionMultiplier(stateCode: string): number {
  return STATE_MAP.get(stateCode)?.regionMultiplier ?? 1.0;
}

export const MATERIAL_CATEGORIES = [
  "cement", "steel_rod", "coarse_sand", "fine_sand",
  "aggregate_20mm", "brick", "bitumen", "rcc_pipe",
  "lime", "paint", "tiles", "timber", "glass", "copper_wire",
  "pvc_pipe", "ms_plate", "gravel", "stone_chips"
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];
