export interface Capital {
  name: string;
  aliases: readonly string[];
  note?: string;
}

// Natural Earth v5.1.2, public domain, with reviewed corrections and explicit
// accepted alternatives. Reviewed 2026-11-11. See CAPITALS.md for sources,
// the exact source checksum, and policies on multiple or disputed capitals.
// Country IDs are the atlas's lowercase ISO 3166-1 alpha-2 codes.
const records = `
af|Kabul
al|Tirana
dz|Algiers
ad|Andorra la Vella
ao|Luanda
ag|Saint John's|St John’s
ar|Buenos Aires
am|Yerevan
au|Canberra
at|Vienna|Wien
az|Baku
bs|Nassau
bh|Manama
bd|Dhaka|Dacca
bb|Bridgetown
by|Minsk
be|Brussels|Bruxelles;Brussel
bz|Belmopan
bj|Porto-Novo|Cotonou
bt|Thimphu
bo|Sucre|La Paz
ba|Sarajevo
bw|Gaborone
br|Brasília
bn|Bandar Seri Begawan
bg|Sofia
bf|Ouagadougou
bi|Gitega
cv|Praia
kh|Phnom Penh|Phnum Penh
cm|Yaoundé
ca|Ottawa
cf|Bangui
td|N'Djamena|N Djamena
cl|Santiago
cn|Beijing|Peking
co|Bogotá
km|Moroni
cg|Brazzaville
cr|San José
ci|Yamoussoukro|Abidjan
hr|Zagreb
cu|Havana|La Habana
cy|Nicosia
cz|Prague|Praha
cd|Kinshasa
dk|Copenhagen|København;Kobenhavn
dj|Djibouti|Djibouti City
dm|Roseau
do|Santo Domingo
ec|Quito
eg|Cairo|Al Qahirah;Al Qahira;New Administrative Capital;The New Capital;New Capital
sv|San Salvador
gq|Ciudad de la Paz|Oyala;Djibloho
er|Asmara
ee|Tallinn
sz|Mbabane|Lobamba
et|Addis Ababa|Addis Abeba
fj|Suva
fi|Helsinki
fr|Paris
ga|Libreville
gm|Banjul
ge|Tbilisi
de|Berlin
gh|Accra
gr|Athens|Athina;Athinai
gd|Saint George's|St George’s
gt|Guatemala City|Ciudad de Guatemala;Guatemala
gn|Conakry
gw|Bissau
gy|Georgetown
ht|Port-au-Prince
hn|Tegucigalpa|Comayagüela;Tegucigalpa and Comayagüela
hu|Budapest
is|Reykjavík
in|New Delhi|Delhi
id|Jakarta|Djakarta
ir|Tehran|Teheran
iq|Baghdad
ie|Dublin
il|Jerusalem|Yerushalayim
it|Rome|Roma
jm|Kingston
jp|Tokyo|Tokio
jo|Amman
kz|Astana|Nur-Sultan;Nursultan
ke|Nairobi
ki|South Tarawa|Tarawa
kw|Kuwait City|Kuwait;Al Kuwayt;Al Kuwait
kg|Bishkek
la|Vientiane|Viang Chan;Vieng Chan
lv|Riga
lb|Beirut|Bayrut
ls|Maseru
lr|Monrovia
ly|Tripoli
li|Vaduz
lt|Vilnius
lu|Luxembourg|Luxembourg City
mg|Antananarivo
mw|Lilongwe
my|Kuala Lumpur|Putrajaya
mv|Malé
ml|Bamako
mt|Valletta
mh|Majuro
mr|Nouakchott
mu|Port Louis
mx|Mexico City|Ciudad de México
fm|Palikir
md|Chișinău|Kishinev
mc|Monaco
mn|Ulaanbaatar|Ulan Bator;Ulaan Baatar
me|Podgorica|Cetinje
ma|Rabat
mz|Maputo
mm|Naypyidaw|Nay Pyi Taw;Naypyitaw
na|Windhoek
nr|Yaren|Yaren District
np|Kathmandu|Katmandu
nl|Amsterdam|The Hague;Den Haag;’s-Gravenhage
nz|Wellington
ni|Managua
ne|Niamey
ng|Abuja
kp|Pyongyang
mk|Skopje
no|Oslo
om|Muscat
pk|Islamabad
pw|Ngerulmud|Ngerulmuud;Melekeok
ps|East Jerusalem|Jerusalem;Ramallah;Al Quds
pa|Panama City|Panamá;Ciudad de Panamá
pg|Port Moresby
py|Asunción
pe|Lima
ph|Manila
pl|Warsaw|Warszawa
pt|Lisbon|Lisboa
qa|Doha
ro|Bucharest|București
ru|Moscow|Moskva
rw|Kigali
kn|Basseterre
lc|Castries
vc|Kingstown
ws|Apia
sm|San Marino|City of San Marino;San Marino City
st|São Tomé
sa|Riyadh|Ar Riyadh
sn|Dakar
rs|Belgrade|Beograd
sc|Victoria
sl|Freetown
sg|Singapore
sk|Bratislava
si|Ljubljana
sb|Honiara
so|Mogadishu|Muqdisho
za|Pretoria|Cape Town;Bloemfontein
kr|Seoul
ss|Juba
es|Madrid
lk|Sri Jayawardenepura Kotte|Sri Jayewardenepura Kotte;Sri Jayawardanapura Kotte;Jayawardenepura Kotte;Jayewardenepura Kotte;Kotte;Colombo
sd|Khartoum
sr|Paramaribo
se|Stockholm
ch|Bern|Berne
sy|Damascus|Dimashq
tj|Dushanbe
tz|Dodoma
th|Bangkok|Krung Thep;Krung Thep Maha Nakhon
tl|Dili
tg|Lomé
to|Nuku'alofa|Nuku Alofa
tt|Port of Spain
tn|Tunis
tr|Ankara
tm|Ashgabat
tv|Funafuti
ug|Kampala
ua|Kyiv|Kiev
ae|Abu Dhabi
gb|London
us|Washington, D.C.|Washington;Washington DC;DC
uy|Montevideo
uz|Tashkent
vu|Port Vila
va|Vatican City|Vatican
ve|Caracas
vn|Hanoi|Ha Noi
ye|Sana’a|Aden
zm|Lusaka
zw|Harare
`;

const notes: Record<string, string> = {
  bi: 'Gitega is the political capital. Bujumbura is the economic capital and is not accepted as the national political capital.',
  bj: 'Porto-Novo is the official capital; Cotonou is the seat of government. Either is accepted.',
  bo: 'Sucre is the constitutional capital; La Paz is the seat of government. Either is accepted.',
  ch: 'Bern is Switzerland’s federal city and de facto capital.',
  ci: 'Yamoussoukro is the political capital; Abidjan remains a government seat and is also accepted.',
  eg: 'Cairo is the constitutional capital. The New Administrative Capital, the government seat, is also accepted.',
  gq: 'Ciudad de la Paz replaced Malabo as the capital on 2 January 2026. Oyala and Djibloho are also accepted names for the capital area.',
  hn: 'Tegucigalpa and Comayagüela together form the Central District, the constitutional capital. Either city is accepted.',
  id: 'Jakarta remains the capital pending the presidential transfer decree. Nusantara is the planned successor.',
  il: 'Jerusalem is Israel’s declared capital and government seat; its international status is disputed.',
  ki: 'South Tarawa is the capital urban area on Tarawa atoll; Tarawa is also accepted.',
  kz: 'The city was renamed from Nur-Sultan back to Astana in 2022. Nur-Sultan is accepted as a former name of the same city.',
  lk: 'Sri Jayawardenepura Kotte is the legislative capital; Colombo, an executive and judicial centre, is also accepted.',
  me: 'Podgorica is the capital; Cetinje is the constitutionally designated Old Royal Capital and is also accepted.',
  my: 'Kuala Lumpur is the national capital; Putrajaya is the federal administrative centre. Either is accepted.',
  nl: 'Amsterdam is the constitutional capital; The Hague is the seat of government. Either is accepted.',
  nr: 'Nauru has no official capital. Yaren District, where government offices are located, is accepted as the de facto answer.',
  ps: 'East Jerusalem is Palestine’s claimed capital; Ramallah is the administrative centre. Jerusalem and Ramallah are also accepted; the status of Jerusalem is disputed.',
  pw: 'Ngerulmud is the capital, in Melekeok State. Melekeok is also accepted as a common geographic reference to the capital area.',
  ss: 'Juba remains the capital. The proposed city of Ramciel is not accepted as the current capital.',
  sz: 'Mbabane is the administrative capital; Lobamba is the royal and legislative capital. Either is accepted.',
  tz: 'Dodoma is the capital. Dar es Salaam, the former capital and main commercial city, is not accepted.',
  ye: 'Sana’a is the constitutional capital; Aden is the temporary government capital. Either is accepted.',
  za: 'South Africa has three capitals: Pretoria (administrative), Cape Town (legislative), and Bloemfontein (judicial). Any one is accepted.',
};

export const capitalsByCountry: Record<string, Capital> = Object.fromEntries(
  records.trim().split('\n').map((line) => {
    const [id, name, aliases = ''] = line.split('|');
    return [id, { name, aliases: aliases ? aliases.split(';') : [], ...(notes[id] ? { note: notes[id] } : {}) }];
  }),
);
