export const CONTINENTS = [
  'Africa',
  'Asia',
  'Europe',
  'North America',
  'South America',
  'Oceania',
] as const;
export type Continent = (typeof CONTINENTS)[number];

export interface Country {
  id: string;
  name: string;
  continent: Continent;
  aliases: string[];
  flag: string;
}

// UN members + the Holy See (Vatican City) and Palestine. Each country has one
// continent, following UN M49 geographic regions (the Americas split in two).
// Russia → Europe; Türkiye, Cyprus, the Caucasus, Kazakhstan, Timor-Leste → Asia;
// Egypt → Africa. See README.md for sources and classification details.
const records = `
af|Afghanistan|Asia|Islamic Republic of Afghanistan
al|Albania|Europe
dz|Algeria|Africa
ad|Andorra|Europe
ao|Angola|Africa
ag|Antigua and Barbuda|North America|Antigua & Barbuda
ar|Argentina|South America
am|Armenia|Asia
au|Australia|Oceania
at|Austria|Europe
az|Azerbaijan|Asia
bs|Bahamas|North America|The Bahamas
bh|Bahrain|Asia
bd|Bangladesh|Asia
bb|Barbados|North America
by|Belarus|Europe
be|Belgium|Europe
bz|Belize|North America
bj|Benin|Africa
bt|Bhutan|Asia
bo|Bolivia|South America|Plurinational State of Bolivia
ba|Bosnia and Herzegovina|Europe|Bosnia & Herzegovina;Bosnia Herzegovina
bw|Botswana|Africa
br|Brazil|South America|Brasil
bn|Brunei|Asia|Brunei Darussalam
bg|Bulgaria|Europe
bf|Burkina Faso|Africa
bi|Burundi|Africa
cv|Cabo Verde|Africa|Cape Verde
kh|Cambodia|Asia
cm|Cameroon|Africa
ca|Canada|North America
cf|Central African Republic|Africa|CAR
td|Chad|Africa
cl|Chile|South America
cn|China|Asia|People's Republic of China;PRC
co|Colombia|South America
km|Comoros|Africa|Union of the Comoros
cg|Republic of the Congo|Africa|Congo Republic;Congo-Brazzaville;Republic of Congo
cr|Costa Rica|North America
ci|Côte d’Ivoire|Africa|Ivory Coast;Cote d Ivoire;Cote dIvoire
hr|Croatia|Europe
cu|Cuba|North America
cy|Cyprus|Asia
cz|Czechia|Europe|Czech Republic
cd|Democratic Republic of the Congo|Africa|DR Congo;DRC;Congo-Kinshasa;Democratic Republic of Congo
dk|Denmark|Europe
dj|Djibouti|Africa
dm|Dominica|North America
do|Dominican Republic|North America
ec|Ecuador|South America
eg|Egypt|Africa|Arab Republic of Egypt
sv|El Salvador|North America
gq|Equatorial Guinea|Africa
er|Eritrea|Africa
ee|Estonia|Europe
sz|Eswatini|Africa|Swaziland;Kingdom of Eswatini
et|Ethiopia|Africa
fj|Fiji|Oceania
fi|Finland|Europe
fr|France|Europe
ga|Gabon|Africa
gm|Gambia|Africa|The Gambia
ge|Georgia|Asia
de|Germany|Europe
gh|Ghana|Africa
gr|Greece|Europe
gd|Grenada|North America
gt|Guatemala|North America
gn|Guinea|Africa
gw|Guinea-Bissau|Africa|Guinea Bissau
gy|Guyana|South America
ht|Haiti|North America
hn|Honduras|North America
hu|Hungary|Europe
is|Iceland|Europe
in|India|Asia
id|Indonesia|Asia
ir|Iran|Asia|Islamic Republic of Iran
iq|Iraq|Asia
ie|Ireland|Europe|Republic of Ireland
il|Israel|Asia
it|Italy|Europe
jm|Jamaica|North America
jp|Japan|Asia
jo|Jordan|Asia
kz|Kazakhstan|Asia
ke|Kenya|Africa
ki|Kiribati|Oceania
kw|Kuwait|Asia
kg|Kyrgyzstan|Asia|Kyrgyz Republic;Kirgizstan
la|Laos|Asia|Lao People's Democratic Republic;Lao PDR
lv|Latvia|Europe
lb|Lebanon|Asia
ls|Lesotho|Africa
lr|Liberia|Africa
ly|Libya|Africa
li|Liechtenstein|Europe
lt|Lithuania|Europe
lu|Luxembourg|Europe
mg|Madagascar|Africa
mw|Malawi|Africa
my|Malaysia|Asia
mv|Maldives|Asia|The Maldives
ml|Mali|Africa
mt|Malta|Europe
mh|Marshall Islands|Oceania|Republic of the Marshall Islands
mr|Mauritania|Africa
mu|Mauritius|Africa
mx|Mexico|North America
fm|Micronesia|Oceania|Federated States of Micronesia;FSM
md|Moldova|Europe|Republic of Moldova
mc|Monaco|Europe
mn|Mongolia|Asia
me|Montenegro|Europe
ma|Morocco|Africa
mz|Mozambique|Africa
mm|Myanmar|Asia|Burma
na|Namibia|Africa
nr|Nauru|Oceania
np|Nepal|Asia
nl|Netherlands|Europe|The Netherlands;Holland
nz|New Zealand|Oceania
ni|Nicaragua|North America
ne|Niger|Africa
ng|Nigeria|Africa
kp|North Korea|Asia|Democratic People's Republic of Korea;DPRK;DPR Korea
mk|North Macedonia|Europe|Republic of North Macedonia
no|Norway|Europe
om|Oman|Asia
pk|Pakistan|Asia
pw|Palau|Oceania
ps|Palestine|Asia|State of Palestine
pa|Panama|North America
pg|Papua New Guinea|Oceania|PNG
py|Paraguay|South America
pe|Peru|South America
ph|Philippines|Asia|The Philippines
pl|Poland|Europe
pt|Portugal|Europe
qa|Qatar|Asia
ro|Romania|Europe
ru|Russia|Europe|Russian Federation
rw|Rwanda|Africa
kn|Saint Kitts and Nevis|North America|St Kitts and Nevis;Saint Kitts & Nevis;St Kitts & Nevis
lc|Saint Lucia|North America|St Lucia
vc|Saint Vincent and the Grenadines|North America|St Vincent and the Grenadines;Saint Vincent & the Grenadines;St Vincent & the Grenadines
ws|Samoa|Oceania
sm|San Marino|Europe
st|São Tomé and Príncipe|Africa|Sao Tome & Principe
sa|Saudi Arabia|Asia|Kingdom of Saudi Arabia
sn|Senegal|Africa
rs|Serbia|Europe
sc|Seychelles|Africa|The Seychelles
sl|Sierra Leone|Africa
sg|Singapore|Asia
sk|Slovakia|Europe|Slovak Republic
si|Slovenia|Europe
sb|Solomon Islands|Oceania|The Solomon Islands
so|Somalia|Africa
za|South Africa|Africa|Republic of South Africa
kr|South Korea|Asia|Republic of Korea;ROK
ss|South Sudan|Africa
es|Spain|Europe
lk|Sri Lanka|Asia
sd|Sudan|Africa|The Sudan
sr|Suriname|South America|Surinam
se|Sweden|Europe
ch|Switzerland|Europe
sy|Syria|Asia|Syrian Arab Republic
tj|Tajikistan|Asia
tz|Tanzania|Africa|United Republic of Tanzania
th|Thailand|Asia
tl|Timor-Leste|Asia|East Timor
tg|Togo|Africa
to|Tonga|Oceania
tt|Trinidad and Tobago|North America|Trinidad & Tobago
tn|Tunisia|Africa
tr|Türkiye|Asia|Turkey;Turkiye
tm|Turkmenistan|Asia
tv|Tuvalu|Oceania
ug|Uganda|Africa
ua|Ukraine|Europe
ae|United Arab Emirates|Asia|UAE;The United Arab Emirates
gb|United Kingdom|Europe|UK;Great Britain;Britain;United Kingdom of Great Britain and Northern Ireland
us|United States|North America|USA;US;United States of America;The United States
uy|Uruguay|South America
uz|Uzbekistan|Asia
vu|Vanuatu|Oceania
va|Vatican City|Europe|Holy See;The Holy See;Vatican;Vatican City State
ve|Venezuela|South America|Bolivarian Republic of Venezuela
vn|Vietnam|Asia|Viet Nam
ye|Yemen|Asia
zm|Zambia|Africa
zw|Zimbabwe|Africa
`;

export const countries: Country[] = records
  .trim()
  .split('\n')
  .map((line) => {
    const [id, name, continent, aliases = ''] = line.trim().split('|');
    return {
      id,
      name,
      continent: continent as Continent,
      aliases: aliases ? aliases.split(';') : [],
      flag: `/flags/${id}.svg`,
    };
  });

export const continentCounts = Object.fromEntries(
  CONTINENTS.map((continent) => [
    continent,
    countries.filter((country) => country.continent === continent).length,
  ]),
) as Record<Continent, number>;
