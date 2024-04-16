import * as R from 'ramda'
import csv from 'csv-parser'
import * as fs from 'fs'
import {iso1A2Code} from '@rapideditor/country-coder'
import {getCountryName} from "./iso1a2toname.js"

function parseCsv(filepath) {
    return new Promise( (resolve, reject) => {
        const results = []
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', (data) => {
                //console.log(data)
                results.push(data)
            })
            .on('end', () => {
                resolve(results)
            })
            .on('error', (error)=> {
                reject(error)
            });
    })
}

function readCsv(filepath) {
    try{
        return parseCsv(filepath)
    }
    catch (error) {
        console.error('Erreur : ', error)
    }
}

// Fonctions pour savoir si un élément a sa valeur entre deux autres
function isBetweenUp(a, b, c) {
    return (a < b) && (b < c)
}

function isBetweenDown(a, b, c) {
    return (a > b) && (b > c)
}

// Fonctions pour identifier le nombre de mesures correspondant à une période
function findPeriodLat(data) {
    try {
        // On récupère les latitudes
        const lats = R.map(parseFloat, R.pluck("lat", data))

        // On prend la première latitude comme référence
        const ref = lats[0]

        // On identifie  le temps entre la première latitude et
        // la première fois que cette latitude est traversée en
        // montée et en descente
        const tDecreasing = R.findIndex((i) => isBetweenDown(lats[i], ref, lats[i + 1]), R.range(0, lats.length)) + 1
        const tIncreasing = R.findIndex((i) => isBetweenUp(lats[i], ref, lats[i+1]), R.range(0, lats.length)) + 1

        // La plus grande de ces valeurs correspond à la période
        // d'oscillation de la latitude
        return R.max(tDecreasing, tIncreasing)
    }
    catch (error) {
        console.error('Erreur : ', error)
    }
}

function findPeriodLng(data) {
    try {
        const lngs = R.map(parseFloat, R.pluck("lon", data))

        const ref = lngs[0]

        const tDecreasing = R.findIndex((i) => isBetweenDown(lngs[i], ref, lngs[i + 1]), R.range(0, lngs.length)) + 1
        const tIncreasing = R.findIndex((i) => isBetweenUp(lngs[i], ref, lngs[i+1]), R.range(0, lngs.length)) + 1

        return R.max(tDecreasing, tIncreasing)
    }
    catch (error) {
        console.error('Erreur : ', error)
    }
}

// Fonction qui va prédire les mouvements de l'ISS sur x heures
async function predictLatLng(exPos, currPos, hours) {
    // Données passées récoltées grâce à notre application qui vont servir de référence
    const data = await readCsv('assets/data.csv')
    const periodLat = findPeriodLat(data)
    const periodLng = findPeriodLng(data)
    // Période à laquelle les mesures de référence ont été prises
    const secPerTick = 9
    // Détermination du nombre de prédictions à faire pour les x heures
    const nPredictions = Math.trunc(hours*3600/secPerTick)

    const lats = R.pluck('lat', data)
    const lngs = R.pluck('lon', data)

    // Permet de déterminer si l'ISS est en montée pour la latitude pour identifier la valeur historique la plus proche
    const exLat = exPos['latitude']
    const currLat = currPos['latitude'], currLng = currPos['longitude'], currTime = currPos['timestamp']
    const isRising = exLat < currLat

    // L'indice historique le plus proche à partir duquel on va commencer à prédire
    let startingIndex
    if(isRising) startingIndex = R.findIndex((i) => isBetweenUp(exLat, lats[i], currLat), R.range(0, lats.length))
    else startingIndex = R.findIndex((i) => isBetweenDown(exLat, lats[i], currLat), R.range(0, lats.length))

    // On calcule le décalage entre la position actuelle et la référence historique
    const biasLat = currLat - parseFloat(lats[startingIndex])
    const biasLng = currLng - parseFloat(lngs[startingIndex])

    // On crée des valeurs en se déplaçant au fil de l'historique tout en gardant le biais trouvé au-dessus et en
    // corrigeant les valeurs trop faibles ou élevées
    const predictions = []
    for(let i=0; i<nPredictions; i++) {
        const indexLat = i%periodLat
        const indexLng = i%periodLng
        let predLat = parseFloat(lats[startingIndex + indexLat]) + biasLat
        let predLng = parseFloat(lngs[startingIndex + indexLng]) + biasLng
        if (predLng < -180) {predLng += 360}
        else if (predLng > 180) {predLng -= 360}
        const predTime = currTime + secPerTick*i

        predictions.push({'time': predTime, 'lat':predLat, 'lon':predLng})
    }
    return predictions
}

// Fonction pour obtenir la position actuelle
function getExAndCurrInfo() {
    let uri = 'https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps='
    const currTimestamp = Math.floor(Date.now()/1000)
    const exTimestamp = currTimestamp - 5
    uri += currTimestamp + ',' + exTimestamp
    return fetch(uri)
        .then(response => {
            if(response.ok){
                return response.json()
            } else {
                throw new Error('API request failed')
            }
        })
        .then(data => {
            return data
        })
        .catch(error => {
            console.error(error)
        })
}

// Fonction pour calculer le nombre de fois que l'ISS rentre danss le territoire d'un pays et quand
function getCountries(predictions) {
    //const geojsonData = JSON.parse(fs.readFileSync('assets/ne_110m_admin_0_countries.geojson', 'utf8'))
    let countries = {}
    let previousCountry = '', country, lat, lng
    for(let i = 0; i< predictions.length; i++) {
        lat = predictions[i]['lat']
        lng = predictions[i]['lon']
        country = iso1A2Code([lng, lat])
        if(previousCountry !== country){
            if(countries[country]) {
                countries[country].push(parseInt(predictions[i]['time']))
            }
            else {
                countries[country] = [parseInt(predictions[i]['time'])]
            }
        }
        previousCountry = country
    }
    return R.omit(['null'], countries)
}

// Fonction pour calculer le temps total passé au-dessus de chaque payas par l'ISS
function getCountriesFlyoverTime(predictions) {
    return R.pipe(
        R.map(
            R.multiply(9),
         ),
        R.omit(['null'])
    )(R.countBy(point => iso1A2Code([point['lon'], point['lat']]), predictions))
}

// Résume les données dans une liste d'objets
async function countriesSummary(hours) {
    const currInfo = await getExAndCurrInfo()
    const currPos = currInfo[0], exPos = currInfo[1]
    const predicted = await  predictLatLng(exPos, currPos, hours)
    const countries = getCountries(predicted)
    const countriesFlyoverTime = getCountriesFlyoverTime(predicted)
    const summary = R.pipe(
        R.keys,
        R.map(
            (key) => ({country:key, entries:countries[key], flyoverTime:countriesFlyoverTime[key]})
        )
    )(countries)
    return summary
}

// Convertit un nombre de secondes en temps lisible
function formatDuration(seconds) {
    const hours = Math.floor(seconds/ 3600)
    const minutes = Math.floor((seconds - hours * 3600)/60)
    const remSeconds = seconds % 60

    let string = ''
    if(hours > 0) string += ' ' + hours + ' hours'
    if(minutes > 0) string += ' ' + minutes + ' minutes'
    if(remSeconds > 0) string += ' ' + remSeconds + ' seconds'

    return string
}

// Rend le résumé plus facilement lisible sans changer les valeurs
async function readableSummary(hours){
    const summary = await countriesSummary(hours)
    const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'medium'
    })

    const newSummary = R.map(countryData => ({
        ...countryData,
        country: getCountryName(countryData.country),
        entries: R.map(time => dateTimeFormat.format(new Date(time * 1000)) + ' UTC+2', countryData.entries),
        flyoverTime: formatDuration(countryData.flyoverTime)
    }), summary);
    return newSummary
}



// On peut remplacer l'heure par le nombre qu'on souhaite
readableSummary(24).then((result) => console.log(result))