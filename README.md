# ProjetImpressionnant

Un outil basé sur une API donnant la position en temps réel de l'ISS <br>
* _API : https://wheretheiss.at/ <br>_
* _Une extension du projet NasaNow : https://github.com/PepitoLeFameux/NasaNow_

## Prédiction de trajectoire
A partir d'un historique de trajectoire stocké à l'avance grâce à des mesures constantes, le script peut générer une trajectoire théorique sur un temps donné

## Pays traversés
Permet d'à partir d'une prédiction de chemin, de déterminer quels pays vont être traversés, combien de fois et à quel moment

## Durée totale de survol
La durée pendant laquelle l'ISS va survoler chaque pays pendant les X prochaines heures est également calculée

___

## Exemple

```js
const hours = 24
const summary = await readableSummary(hours)
console.log(summary)
```
```
[                                       
  {                                     
    country: 'Chad',                    
    entries: [                          
      'Apr 16, 2024, 3:25:35 PM UTC+2', 
      'Apr 17, 2024, 6:53:11 AM UTC+2'  
    ],                                  
    flyoverTime: ' 3 minutes 36 seconds'
  },
  {
    country: 'Sudan',
    entries: [
      'Apr 16, 2024, 3:26:02 PM UTC+2',
      'Apr 17, 2024, 12:05:38 AM UTC+2',
      'Apr 17, 2024, 6:56:20 AM UTC+2'
    ],
    flyoverTime: ' 6 minutes 45 seconds'
  }
...
]
```

Il est possible de sélectionner un pays avec la fonction `queryCountry()`:

```js
queryCountry(summary, 'Chile', hours)
```
```
In the next 24 hours, the ISS will enter Chile 7 times :
 -  Apr 16, 2024, 4:39:20 PM UTC+2
 -  Apr 16, 2024, 6:20:17 PM UTC+2
 -  Apr 16, 2024, 7:59:26 PM UTC+2
 -  Apr 17, 2024, 6:21:11 AM UTC+2
 -  Apr 17, 2024, 8:09:29 AM UTC+2
 -  Apr 17, 2024, 9:50:26 AM UTC+2
 -  Apr 17, 2024, 11:29:26 AM UTC+2
for a total flyover time of 14 minutes 33 seconds
```
___
