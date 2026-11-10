

const definitions = [
  ['srbija', 'Srbija', null],
  ['vojvodina', 'Vojvodina', 'srbija'],
  ['severnobacki-okrug', 'Severnobački okrug', 'vojvodina'],
  ['subotica', 'Subotica', 'severnobacki-okrug'],
  ['radnja-1', 'Radnja 1', 'subotica'],
  ['juznobacki-okrug', 'Južnobački okrug', 'vojvodina'],
  ['novi-sad', 'Novi Sad', 'juznobacki-okrug'],
  ['detelinara', 'Detelinara', 'novi-sad'],
  ['radnja-2', 'Radnja 2', 'detelinara'],
  ['radnja-3', 'Radnja 3', 'detelinara'],
  ['liman', 'Liman', 'novi-sad'],
  ['radnja-4', 'Radnja 4', 'liman'],
  ['radnja-5', 'Radnja 5', 'liman'],
  ['grad-beograd', 'Grad Beograd', 'srbija'],
  ['novi-beograd', 'Novi Beograd', 'grad-beograd'],
  ['bezanija', 'Bežanija', 'novi-beograd'],
  ['radnja-6', 'Radnja 6', 'bezanija'],
  ['vracar', 'Vračar', 'grad-beograd'],
  ['neimar', 'Neimar', 'vracar'],
  ['radnja-7', 'Radnja 7', 'neimar'],
  ['crveni-krst', 'Crveni krst', 'vracar'],
  ['radnja-8', 'Radnja 8', 'crveni-krst'],
  ['radnja-9', 'Radnja 9', 'crveni-krst'],
];

export function buildTree(rows){
    const byId = new Map();

    for(const [id, name, parentId] of rows){
        if(byId.has(id)){
            throw new Error("Duplicate node ID!");
        }

        byId.set(id,{
            _id:id,
            name,
            parentId,
            type: id.startsWith('radnja-') ? 'store' : 'office',
        });
    }

    const roots = rows.filter(row=> row[2]===null);

    if(roots.length !== 1){
        throw new Error('Exactly one root is required.');
    }

    function collectAncestors(id, visiting = new Set()){
        const node = byId.get(id);

        if (!node) {
            throw new Error('Unknown parent.');
        }

        if(visiting.has(id)){
            throw new Error('Cycle in organization tree.');
        }

        if(node.ancestors){
            return node.ancestors;
        }

        if(node.parentId === null){
            node.ancestors = [];
            return node.ancestors;
        }

        visiting.add(id);

        node.ancestors = [
            ...collectAncestors(node.parentId,visiting),
            node.parentId,
        ];

        visiting.delete(id);

        return node.ancestors;
    }

    for(const id of byId.keys()){
        collectAncestors(id);
    }

    return [...byId.values()];

}

export const organizationNodes = buildTree(definitions);