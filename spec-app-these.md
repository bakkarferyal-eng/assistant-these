# Assistant de Thèse — Spec pour l'app réelle

Ce document décrit comment transformer le prototype (artifact React) en une vraie application déployée. À donner à Claude Code comme point de départ.

## Pourquoi une vraie app (vs l'artifact actuel)

L'artifact avait 3 limites structurelles :
- La clé API était appelée directement depuis le navigateur (pas idéal question sécurité à long terme)
- Les données vivent dans un stockage par-utilisateur/par-artifact : impossible d'y accéder depuis un autre appareil, et un lien "Publish" ne partage jamais les données, seulement l'app vide
- Pas de vrai upload de fichiers (PDF/image) — seulement du texte collé

## Stack recommandé

- **Next.js 14+ (App Router)** — frontend + backend dans un seul projet, le plus simple pour un premier vrai projet
- **Supabase** — Postgres (base de données réelle) + Storage (fichiers PDF/images) + authentification, gratuit pour un usage personnel
- **Anthropic SDK côté serveur** (Node) — la clé API ne quitte jamais le serveur
- **Déploiement : Vercel** — gratuit, s'intègre nativement à Next.js

Pourquoi Supabase plutôt que juste un fichier SQLite : Vercel efface le disque entre les requêtes (serverless), donc un fichier local ne survivrait pas. Supabase donne une vraie base + un vrai espace de stockage de fichiers, hébergés en continu.

## Modèle de données (tables)

```
projects       (id, context, objectif, modele, roadmap, resultats_data)
chapters       (id, project_id, name, order, status)
points         (id, chapter_id, text, order)
chapter_data   (chapter_id, sequence, writing, feedback, draft_example)
ideas          (id, project_id, text, source, status, chapter_id)
references     (id, project_id, raw, formatted)
quick_notes    (id, project_id, column, text)
journal        (id, project_id, date, text)
uploads        (id, project_id, filename, file_type, extracted_text, chapter_id, storage_path)
```

## Fonctionnalités

**Reprises telles quelles du prototype :**
Projet & Modèle, Notes rapides (3 colonnes), Chapitres (points → Séquencer → Rédaction avec Exemple/Corriger), Boîte à idées, Références (avec formatage IEEE anti-invention), Journal de bord, Aujourd'hui (question/devoir/idée/article, ces deux derniers avec recherche web réelle).

**Nouvelles capacités (le but de cette migration) :**
1. **Upload PDF/DOCX/image réel** — au lieu de coller du texte, un vrai bouton d'upload. Le fichier est stocké dans Supabase Storage, et le texte est extrait automatiquement (pdf-parse pour PDF, mammoth pour DOCX). Pour les images et PDF complexes, envoyer directement le fichier à Claude (l'API accepte PDF et images en base64 dans le message) plutôt que de compter uniquement sur l'extraction de texte — Claude peut lire des schémas, tableaux, mises en page.
2. **Export réel en .docx** — en plus du texte copiable actuel, un vrai fichier Word téléchargeable (librairie `docx` en Node).
3. **Authentification simple** — email/mot de passe ou lien magique (Supabase Auth le gère directement). Ça résout le problème de partage : les données appartiennent à un compte, pas à un artifact.
4. **Recherche web pour idée/article** — déjà conçu dans le prototype, à reporter tel quel côté serveur (tool `web_search` de l'API Claude).

## Structure de projet suggérée

```
/app
  /projet, /notes, /chapitres, /idees, /references, /journal, /today   (pages)
  /api/generate/[action]/route.ts   (questionner→séquencer, corriger, exemple, daily)
  /api/upload/route.ts              (upload + extraction PDF/DOCX/image)
  /api/export/route.ts              (génère le .docx)
/lib
  supabase.ts, anthropic.ts, prompts.ts   (les system prompts qu'on a déjà écrits et validés)
/components
  (un composant par fenêtre, en partant du JSX déjà existant)
```

## Plan de construction, étape par étape

Donner ces étapes à Claude Code **une par une**, pas toutes en même temps — ça évite qu'il essaie de tout faire d'un coup et se perde.

1. **Setup** : projet Next.js, compte Supabase, schéma de base de données ci-dessus, connexion testée.
2. **CRUD de base** : Projet/Modèle + Chapitres avec points (sans IA encore) — juste lire/écrire dans la base.
3. **Intégration Claude côté serveur** : Séquencer, Corriger, Exemple, en réutilisant les prompts déjà écrits et testés dans le prototype.
4. **Upload de fichiers** : PDF/DOCX/image → Supabase Storage + extraction de texte.
5. **Boîte à idées, Références, Journal, Notes rapides.**
6. **Aujourd'hui** avec recherche web.
7. **Export .docx, authentification, déploiement sur Vercel.**

## Premier message à donner à Claude Code

```
Je veux créer une app Next.js (App Router) + Supabase pour un assistant de
rédaction de mémoire de master. J'ai un cahier des charges complet dans
spec-app-these.md à la racine du projet — lis-le entièrement d'abord.

Commence uniquement par l'étape 1 du plan de construction : setup du projet
Next.js, connexion Supabase, et création du schéma de base de données décrit
dans la section "Modèle de données". Ne touche pas encore aux autres étapes.
Explique-moi chaque commande avant de l'exécuter, je débute avec Claude Code.
```

Mets ce fichier à la racine de ton dossier de projet avant de lancer `claude`.
