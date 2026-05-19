# Benchmark Juridique — 5 questions pièges (droit immobilier français)

**Objectif** : crash-test de Nestenn Juridique (Mistral Large 3) sur des subtilités de haut niveau. Pour chaque question, l'agent doit fournir une réponse complète qui couvre les **mots-clés de scoring**. La réponse stricte attendue sert de référence pour juger.

**Méthode de scoring suggérée** : 1 point par mot-clé correctement identifié et appliqué (≠ simple mention). Score ≥ 80% = bon. Score < 50% sur une question = revoir le prompt ou le RAG.

---

## Question 1 — Loi Hoguet : pouvoir du négociateur salarié et rétractation hors établissement

**Énoncé**
> Un négociateur salarié d'une agence immobilière (titulaire d'une attestation préalable d'activité) se déplace au domicile d'un vendeur particulier le samedi matin et lui fait signer un mandat exclusif de vente d'une maison, à l'en-tête de l'agence. Le négociateur trouve un acquéreur 5 jours plus tard au prix demandé. Le vendeur, qui ne souhaite finalement plus vendre, peut-il se rétracter du mandat et refuser de signer le compromis ?

**Pièges à détecter**
1. Confusion entre carte professionnelle T (titulaire) et attestation de négociateur salarié — les deux permettent de faire signer un mandat.
2. **Oubli majeur** du délai de rétractation de 14 jours pour contrats hors établissement (art. L221-18 Code consommation), applicable au mandat signé au domicile du vendeur particulier.
3. Confusion entre le mandat (signé hors établissement = rétractation 14j) et le compromis de vente (rétractation SRU 10j) qui sont deux contrats distincts avec des régimes différents.

**Réponse stricte attendue**
- Le négociateur salarié **est habilité** à faire signer le mandat au nom du titulaire de la carte T, par son attestation préalable d'activité (art. 9 du décret n°72-678).
- Le mandat doit obligatoirement être à l'en-tête du titulaire de la carte T, mentionner l'attestation du négociateur, et être inscrit au registre des mandats sous un numéro d'ordre unique (art. 72 décret n°72-678).
- **MAIS** : le mandat signé au domicile du vendeur est un contrat conclu **hors établissement** au sens du Code de la consommation. Le vendeur particulier (non-professionnel) bénéficie d'un délai de rétractation de **14 jours** (art. L221-18 Code conso), sauf s'il a expressément demandé la visite du négociateur à son domicile et que cela est mentionné dans un document distinct.
- Le mandat ne peut donc pas être exécuté avant la fin de ce délai sans accord exprès du vendeur. Si le vendeur se rétracte entre J et J+14, le mandat est anéanti rétroactivement et l'agence ne peut pas réclamer de commission.

**Mots-clés de scoring**
- [ ] Attestation préalable / habilitation du négociateur salarié
- [ ] Référence art. 9 ou art. 72 décret 72-678 (loi Hoguet)
- [ ] Délai de rétractation **14 jours** (et pas 10 jours)
- [ ] Référence art. L221-18 Code de la consommation
- [ ] Notion de contrat **hors établissement**
- [ ] Distinction avec le délai SRU de 10 jours (qui s'applique au compromis, pas au mandat)

---

## Question 2 — DPE et renouvellement de bail (loi Climat & Résilience)

**Énoncé**
> Un propriétaire-bailleur loue depuis janvier 2020 un appartement parisien classé **G** au DPE (audit énergétique réalisé en 2023, travaux non engagés). Le bail de 3 ans arrive à échéance le 31 mars 2026 et le locataire souhaite rester. Le bailleur peut-il signer un renouvellement de bail pour 3 années supplémentaires en conservant le même loyer ?

**Pièges à détecter**
1. Confusion entre **bail en cours** (qui peut continuer même classé G) et **renouvellement** (juridiquement un nouveau bail, donc soumis aux interdictions).
2. **Date butoir** : depuis le 1er janvier 2025 (et non 2028 comme pour les F), les logements G sont interdits à la location pour tout **nouveau bail ou renouvellement**.
3. Risque d'oubli du **gel du loyer** depuis 2022 pour les passoires énergétiques (F et G) — la révision annuelle d'indice IRL est interdite.
4. Subtilité : la **tacite reconduction** d'un bail (3 ans) est-elle un nouveau bail au sens de la loi ? **Oui** selon l'art. 17 loi Climat & Résilience.

**Réponse stricte attendue**
- L'art. 17 de la loi Climat & Résilience du 22 août 2021 (modifiant la loi du 6 juillet 1989) interdit la conclusion d'un **nouveau contrat de location** pour les logements classés **G à compter du 1er janvier 2025** (puis F à partir de 2028, puis E à partir de 2034).
- La Cour de cassation et la doctrine considèrent que le **renouvellement** d'un bail (même de plein droit ou par tacite reconduction) constitue un nouveau contrat au sens de cet article (Cass. 3ème civ., interprétation extensive).
- **Conséquence** : le bailleur ne peut PAS renouveler le bail pour 3 ans en l'état. Il doit soit :
  - Réaliser les travaux d'amélioration énergétique pour atteindre au minimum la classe **F** (et idéalement E pour anticiper 2028) avant le 31 mars 2026.
  - Soit reprendre le logement (congé pour vendre ou reprise) en respectant le délai légal de 6 mois avant échéance, étant entendu que la location à un nouveau locataire restera interdite.
- **Gel du loyer** : depuis le 24 août 2022, le loyer des passoires énergétiques (F et G) est gelé : interdiction d'augmenter le loyer lors d'un renouvellement, d'une remise en location, ou même de réviser annuellement selon l'IRL (art. 159 loi Climat & Résilience).
- En cas de manquement, le locataire peut saisir le juge pour exiger les travaux, demander une réduction de loyer, voire la résiliation du bail aux torts du bailleur.

**Mots-clés de scoring**
- [ ] Art. 17 loi Climat & Résilience du 22 août 2021
- [ ] Date butoir **1er janvier 2025** pour la classe G (et 2028 pour F)
- [ ] Distinction **bail en cours** (autorisé) vs **renouvellement** (interdit)
- [ ] Gel du loyer / interdiction de révision IRL pour F-G depuis 2022
- [ ] Mention de l'obligation de travaux ou de l'alternative (congé vendre / reprise)
- [ ] Recours possible du locataire (réduction loyer, résiliation)

---

## Question 3 — Rétractation SRU et notification à un couple acquéreur

**Énoncé**
> Un couple marié sous régime de communauté universelle signe un compromis pour acheter une maison. L'agent immobilier envoie une seule LRAR de notification du compromis à l'adresse commune, contenant un exemplaire signé. L'épouse, présente le 5 mai, signe l'accusé de réception. Le mari (en déplacement professionnel pendant 3 semaines) n'a jamais physiquement reçu la notification. Le 25 mai (J+20), le mari souhaite se rétracter unilatéralement et faire annuler le compromis. Est-ce juridiquement possible ?

**Pièges à détecter**
1. Régime matrimonial (communauté universelle) — sans incidence sur la rétractation SRU, qui est attachée à la personne de l'acquéreur, pas au régime.
2. La notification **doit être individuelle** à chaque acquéreur (art. L271-1 CCH). Une LRAR groupée à l'adresse commune n'est valable que si **les deux époux signent l'AR**.
3. Le délai de 10 jours ne court qu'à compter du lendemain de la **présentation de la LRAR à chaque acquéreur** pris isolément.
4. Si la notification d'un des deux acquéreurs n'a jamais été régulière, **son délai n'a JAMAIS commencé à courir** — il peut donc se rétracter à tout moment (sauf si l'acte authentique a déjà été signé).

**Réponse stricte attendue**
- L'art. L271-1 du Code de la construction et de l'habitation impose une notification **individuelle** à chaque acquéreur non-professionnel. Le délai de rétractation de 10 jours est attaché à chaque acquéreur pris isolément.
- Jurisprudence clé : **Cass. 3ème civ., 9 juin 2010, n°09-15.361** — pour un couple, la notification adressée à un seul époux ne fait courir le délai qu'à son égard. L'autre époux conserve la totalité de son droit de rétractation.
- Confirmé par Cass. 3ème civ., 25 février 2016 n°15-12.524 : la signature de l'AR par l'un des deux époux ne vaut pas notification à l'autre, même en cas de communauté universelle.
- **Conséquence pour le cas d'espèce** :
  - L'épouse : délai de 10 jours expiré le 16 mai → ne peut plus se rétracter.
  - Le mari : aucune notification valable reçue → son délai de rétractation **n'a jamais commencé**. Il peut se rétracter à tout moment, y compris le 25 mai et bien au-delà, tant que l'acte authentique n'a pas été signé.
- **Effet de la rétractation d'un seul des co-acquéreurs** : la rétractation d'un époux dans le cadre d'un achat en commun anéantit l'intégralité du compromis (Cass. 3ème civ., 14 mai 2014 n°13-15.350), car le contrat est conclu avec les deux co-acquéreurs indivisiblement.
- **Bonne pratique pour éviter le problème** : soit envoyer 2 LRAR distinctes (une par époux à la même adresse), soit faire signer l'AR par les deux époux, soit utiliser la remise en main propre contre récépissé signé par chaque acquéreur.

**Mots-clés de scoring**
- [ ] Art. L271-1 CCH
- [ ] Notification **individuelle** obligatoire à chaque acquéreur
- [ ] Jurisprudence Cass. 3ème civ. 9 juin 2010 (ou équivalent sur la notification individuelle)
- [ ] Délai de 10 jours n'a **jamais commencé** pour le mari
- [ ] Possibilité de rétractation tardive du mari (oui)
- [ ] Effet sur le compromis dans son ensemble (annulé même si l'épouse ne s'est pas rétractée)
- [ ] Régime matrimonial sans incidence

---

## Question 4 — Mandat exclusif, clause pénale et vente à un membre de la famille

**Énoncé**
> Un propriétaire signe avec une agence un mandat exclusif de vente de 3 mois, à un prix net vendeur de 400 000 €, contenant une clause pénale prévoyant une indemnité forfaitaire de **8% du prix de vente** en cas de vente directe par le mandant pendant le mandat ou dans les 12 mois suivant son expiration. Pendant le mandat, le propriétaire vend directement à son **cousin germain** au prix de 350 000 € sans en informer l'agence. L'agence découvre la vente après la signature de l'acte authentique. Peut-elle réclamer l'indemnité de 8% (sur quel prix ?), et le mandant peut-il invoquer le lien familial pour s'y soustraire ?

**Pièges à détecter**
1. Validité de la clause pénale dans un mandat exclusif (oui, encadrée par l'art. 78 décret 72-678).
2. Le **cousin germain** n'est **pas** un parent en ligne directe — il n'entre pas dans l'exception familiale tacite. Seul un conjoint, ascendant ou descendant pourrait raisonnablement (et encore, seulement si la clause l'exclut expressément).
3. **Base de calcul** : la clause s'applique au prix réel de la vente directe (350 000 €), pas au prix du mandat.
4. **Pouvoir modérateur du juge** (art. 1231-5 Code civil) : possibilité de réduire une clause pénale manifestement excessive.
5. Loyauté du mandant : la dissimulation de la vente aggrave la position du mandant.

**Réponse stricte attendue**
- **Validité de la clause** : l'art. 78 du décret n°72-678 autorise la clause pénale dans un mandat exclusif, à condition qu'elle :
  - Soit acceptée expressément par écrit par le mandant (cocher une case, paragraphe distinct).
  - Soit limitée à la durée du mandat **et 12 mois après expiration** (au-delà = clause réputée non écrite).
  - Soit appliquée uniquement en cas de violation de l'exclusivité (vente directe ou via une autre agence).
- **Application au cousin germain** :
  - Le cousin germain n'est ni conjoint, ni ascendant, ni descendant. Il n'est donc pas couvert par une éventuelle exception familiale tacite (qui n'existe d'ailleurs en jurisprudence que pour les ventes intra-conjugales avant divorce, et encore avec restrictions).
  - **Cass. 1re civ., 18 février 2015 n°14-11.011** confirme que la clause pénale est due dès lors qu'il y a vente directe par le mandant, même au profit d'un membre de la famille, sauf clause contraire expresse dans le mandat.
- **Base de calcul** : la clause pénale s'applique au **prix de la vente directe effective** (350 000 €), sauf si le mandat précise une autre base (ex: prix net vendeur du mandat 400 000 €). L'agence peut donc réclamer **8% de 350 000 € = 28 000 €**.
- **Modération judiciaire** : l'art. 1231-5 du Code civil permet au juge de réduire (ou augmenter) une clause pénale **manifestement excessive ou dérisoire**. Une clause pénale de 8% est plus élevée que la moyenne (5-7% est la fourchette habituelle) — un juge pourrait la modérer, mais elle reste dans la fourchette acceptée par la jurisprudence (Cass. 1re civ., 19 mai 1992 a validé du 10%).
- **Argument supplémentaire pour l'agence** : la dissimulation volontaire de la vente par le mandant constitue un manquement à l'obligation de loyauté contractuelle, ce qui peut justifier de ne PAS modérer la clause pénale.

**Mots-clés de scoring**
- [ ] Art. 78 décret n°72-678 (clause pénale mandat exclusif)
- [ ] Limite temporelle **12 mois après expiration**
- [ ] Application au cousin germain : OUI, clause due
- [ ] Référence Cass. 1re civ. 18 février 2015 (ou équivalent)
- [ ] Base de calcul = prix réel de la vente directe (350 000 €)
- [ ] Art. 1231-5 Code civil (pouvoir modérateur du juge)
- [ ] Notion de loyauté contractuelle / dissimulation aggravante

---

## Question 5 — Bail commercial : déplafonnement des locaux monovalents

**Énoncé**
> Un bail commercial portant sur un hôtel de 25 chambres avec restaurant arrive à renouvellement après 9 ans. Le bailleur souhaite déplafonner le loyer car l'activité a explosé suite à un événement local majeur (afflux de touristes). Le preneur conteste en arguant que la valeur locative n'a pas évolué et que les facteurs locaux de commercialité de la rue sont restés stables. Le bailleur peut-il obtenir le déplafonnement automatique, ou doit-il prouver une modification notable des facteurs locaux de commercialité ?

**Pièges à détecter**
1. Confusion entre **locaux polyvalents** (régime de droit commun, plafonnement par indice ILC sauf modification notable) et **locaux monovalents** (régime dérogatoire, déplafonnement automatique).
2. L'hôtel est un local monovalent par jurisprudence constante.
3. Pour les monovalents : pas besoin de prouver une modification notable des facteurs locaux. Le déplafonnement est de droit.
4. **Méthode d'évaluation** spécifique aux locaux monovalents : valeur locative selon usages de la profession (% du chiffre d'affaires théorique ou méthode hôtelière).
5. Subtilité : le déplafonnement ne signifie PAS augmentation. Il faut quand même justifier la valeur locative.

**Réponse stricte attendue**
- L'art. R145-10 du Code de commerce dispose que **les loyers des locaux construits en vue d'une seule utilisation (dits "monovalents")** sont fixés selon les usages observés dans la branche d'activité considérée, sans application du plafonnement par indice prévu pour les locaux polyvalents.
- **Qualification de local monovalent** : la jurisprudence (Cass. 3ème civ., 9 février 2005 n°03-17.094, confirmée par Cass. 3ème civ., 13 octobre 2010 n°09-15.604) caractérise un local monovalent comme un local **construit ou aménagé en vue d'une seule utilisation** et dont la transformation pour un autre usage nécessiterait des travaux importants. Sont considérés monovalents :
  - Hôtels, hôtels-restaurants, cliniques.
  - Cinémas, théâtres, salles de spectacle.
  - Stations-service.
  - Sont **exclus** : les boutiques classiques, restaurants en pied d'immeuble standard, bureaux.
- **Conséquence sur le renouvellement** : pour un hôtel de 25 chambres avec restaurant intégré, **le déplafonnement est automatique**. Le bailleur n'a PAS à prouver une modification notable des facteurs locaux de commercialité (qui est la condition pour les locaux polyvalents, art. L145-34 et R145-3 à R145-8 C. com.). L'argument du preneur sur la stabilité des facteurs locaux est **sans objet**.
- **Méthode d'évaluation de la nouvelle valeur locative** : approche hôtelière (méthode dite "hôtelière" reconnue par la doctrine et la jurisprudence) — généralement basée sur un pourcentage du chiffre d'affaires théorique TTC, modulé selon les charges, la situation, et l'état des locaux (typiquement 8 à 15% du CA selon la catégorie d'hôtel).
- **Limite** : le déplafonnement ouvre la fixation **à la valeur locative**, qui doit être justifiée par expertise. Si la valeur locative réelle est inférieure au loyer en cours, le bailleur peut paradoxalement perdre. La hausse réelle dépendra du marché local et de la performance économique de l'établissement.
- **Procédure** : à défaut d'accord entre les parties, fixation par le juge des loyers commerciaux (tribunal judiciaire spécialisé) sur expertise contradictoire.

**Mots-clés de scoring**
- [ ] Notion de **locaux monovalents** vs polyvalents
- [ ] Art. R145-10 Code de commerce
- [ ] Déplafonnement **automatique** (pas besoin de prouver modification notable)
- [ ] Hôtel = monovalent (jurisprudence Cass. 3ème civ. 2005)
- [ ] Méthode d'évaluation **hôtelière** ou par usages de la profession
- [ ] Procédure : juge des loyers commerciaux + expertise

---

## Grille de scoring agrégée

| Question | Sujet | Mots-clés totaux | Score minimum attendu |
|---|---|---|---|
| 1 | Loi Hoguet + rétractation hors étab. | 6 | 5/6 |
| 2 | DPE / loi Climat | 6 | 5/6 |
| 3 | Rétractation SRU couple | 7 | 6/7 |
| 4 | Mandat exclusif + clause pénale | 7 | 5/7 |
| 5 | Bail commercial monovalent | 6 | 4/6 |
| **TOTAL** | | **32** | **25/32 ≈ 78%** |

**Interprétation des scores**
- ≥ 85% : excellent, prêt pour la prod
- 70-85% : bon, mais surveiller les questions échouées et les ajouter au corpus RAG
- 50-70% : moyen, retravailler les prompts système ou enrichir le RAG sur les sujets faibles
- < 50% : non viable en l'état, refactor majeur nécessaire

**À noter** : ces questions sont volontairement piégeuses. Un agent qui passe 80% sur ce benchmark sera bien meilleur sur le quotidien des conseillers (questions plus standards).
