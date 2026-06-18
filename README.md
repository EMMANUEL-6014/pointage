# Système de Pointage — Guide de déploiement

## Présentation

Application web de pointage des heures d'arrivée et de départ des employés.
Fonctionne entièrement dans le navigateur (localStorage) — **aucun serveur requis**.
Compatible GitHub Pages (hébergement 100 % gratuit).

---

## Structure des fichiers

```
pointage/
├── index.html          ← Page de connexion (accueil)
├── css/
│   └── style.css       ← Styles complets + responsive
├── js/
│   ├── storage.js      ← Base de données (localStorage)
│   ├── login.js        ← Logique de connexion
│   ├── employee.js     ← Page de pointage employé
│   └── admin.js        ← Tableau de bord admin
└── pages/
    ├── employee.html   ← Interface employé
    └── admin.html      ← Interface administrateur
```

---

## Déploiement sur GitHub Pages

1. Créez un nouveau dépôt GitHub (ex: `pointage-entreprise`)
2. Uploadez tous les fichiers du dossier `pointage/` **à la racine** du dépôt
3. Allez dans **Settings → Pages → Source : main branch / root**
4. Votre site sera disponible à : `https://votre-username.github.io/pointage-entreprise/`

> ⚠️ Le fichier `index.html` doit être à la **racine** du dépôt.

---

## Connexion par défaut

| Rôle          | Identifiant | Mot de passe |
|---------------|-------------|--------------|
| Administrateur | `admin`     | `Admin@2024` |

**Changez le mot de passe admin après le premier déploiement** (dans le code `storage.js`, ligne du `password`).

---

## Fonctionnalités

### Page d'accueil (Connexion)
- Choix du logo de l'entreprise (stocké localement)
- Connexion identifiant + mot de passe
- Redirection automatique selon le rôle

### Espace Employé
- Horloge en temps réel
- Bouton **Pointer l'Arrivée** (enregistre l'heure exacte)
- Bouton **Pointer le Départ** (nécessite d'avoir pointé l'arrivée)
- Zone **Motif** (retard, déplacement, etc.)
- Les deux pointages par jour, reset automatique à 23h59

### Tableau de Bord Admin
- Création / modification / suppression des employés
- Visualisation de tous les pointages avec filtres (employé, période)
- Export **PDF** professionnel
- Export **Excel (.xlsx)**
- Marquage automatique **"Non Signalé"** pour les absences à 23h59

---

## Note technique sur le stockage

Les données sont stockées dans le `localStorage` du navigateur.
- Chaque appareil/navigateur a ses propres données
- Les données persistent entre les sessions
- Si plusieurs employés utilisent des appareils différents, **chacun pointe depuis son propre appareil**
- L'administrateur consulte les pointages depuis son appareil

> Pour une solution multi-appareils centralisée, il faudrait un backend (ex: Firebase, Supabase — gratuit en tier basique).

---

## Réinitialisation à minuit

Le système vérifie automatiquement à **23h59** :
- Si un employé n'a pas pointé son arrivée → **"Non Signalé"** enregistré
- Si un employé n'a pas pointé son départ → **"Non Signalé"** enregistré
- Les cases sont remises à zéro pour le lendemain
