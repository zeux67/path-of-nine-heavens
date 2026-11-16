// Coarse biome grid read off the painted world map: one char per 100x100 map cell.
// . sea, P plain, M mountains, S snow, F forest, D desert, L inland lake, C coast, H hills.
const ROWS = [
    '..............................................................................',
    '...................................CCCCCC.....................................',
    '...C.............................CCCCCCSSC.............CCC....................',
    '..............CCCCCC..CC......CC.CCC..CCCSC...C.....CCCCSCC.....CCC...........',
    '............CCSSSPSCCCCSCC....CCCCC......CC.......CCCSSSSSCCCCCCSSC...........',
    '.......CCCCCCSSSSSSSSSSSSCC...CCCSCCC.......C.....CSSSSSSSSSSSSSSSSCCC........',
    '......CCSSSSSSSSSSSSSSSPCC..C...CCC...........CCCCCSSSSSSSSSSSSSSSSSSCC.......',
    '.....CCCSSSLPSSSSSSSSSSSPCCCCC......CCCC.....CSSSSSSSSSSMSSSSSSSSLLSSPC.......',
    '...CCCPPPPPLPPPPPPSPPPPSPSSPMPC....PCPPCC....CMPPPMPPMPPMMMPPSPPPLLMPPPCC.....',
    '...PPPPPPPPPPPHPPPPPPPPMPLLMMCC...PPPPPPPP..PPCPMPMMPMMHFMMMPPPPPLPPPPPPPP....',
    '..CPMPPPPPPPPPFPPPPPPPPPPPMMMC.....PPMPPCC..PC.CMPMMPHFFFFFMPPPPPPPPPMPPMCCC..',
    '..CMMPPPPPPPPPPPPMPPPPPPPPMMPC......PPC.....CCCPPPPMMFFFFFFFMPPPPPPPPPPPPMMPC.',
    '.PPPPPPPPPPPPPPLLMMPPPPPPPCCP....C............CPPPPMMMFFFFFPMPPPPPPPPPPPPPPPP.',
    '.CPPPLLPPPPPPPPLLLPPPPMMC..C....CC............CPPPPPPMFSSFFPPPPPPPPPPPPLLLPPP.',
    '..PPPLMMFFPPPPPPHFFMMPCCC.....C......CPC........PPC.PPMPPFFFMMPPPPPPPPPLLLPPP.',
    '...CMLLMMMFFPFFPPPFFPPC.............PPMPCCC......CC..PCCCCHFMPMMMPPPPPPPLCPPP.',
    '...CMMMHMMMFFFFCCCCCCC............PPPPPPFFCC.........CC...PMMMMMPMMPPPPPPMPC..',
    '...CMMMMMMMFFFFC...C...C........PCCPPPPPFFC.....C.........PMMMMMFPMPPPMMPPC...',
    '...PPMMMMPCCPCCC....CCCCCCC....PPMMMMPPPFFFCC......CC.....CPCCCCPPPPPPPCPC....',
    '....PMMMPC.CCC.....CPMPFFPC....PMDPPPPPPFCFPCC...PPPCPP.....C..CMPPPP..PP.....',
    '....CPMMC........C.CPMMFFPC....CCDDDDDPLMLFCC...CPPPPPPPCC....CCMMC....C......',
    '.....PMCC.......CCFCHMMMMPC.....CDDDDDLLMFCC....CMPPPPPPPCC...PPPPC...........',
    '.....CCC.......CCFFFFMMMCC.......CDDDMPMMFCC...PPCDDPLPPFMC..CC......CPPPPC...',
    '......CC.......CCFFFFMPCC........CCCDPPCCCCC...C.CDDPLLPFPC.........CDDCCMP...',
    '................PMMPCCP.............PP..CC........CDMPCMPCC..........C..CMP...',
    '..............C.CPCCC.....CPDCC....................CCPMPCC....C...CCCCPPPPC...',
    '.......................CPPPMDDDDC.........CCP..C.....PPC..........C..CCPPC....',
    '........CCC.PCCC.......PMPPPPPDPPP......CCCMPCCPPPC...C....C...............C..',
    '.....CCCCCCCPHPC.......CPPDDPPPPPPC....CCFFFFFFPPPP............CCCCCC.........',
    '.....CMMMMPMMMPC........PDDDPPPHCC......CPFFFFFFPMC..........CCPMDDDCCCP......',
    '..CCCCMMPMMMMMMCCC......PDDDPPPCC.......CCPFFFFPPPC......CCPCCMPDDDDDDMPPC....',
    '.PPPPMFFFMMMMMMPMPPPC...CPCPCCCC...C.....CCFFFPPPP......CCFMMMPPPDDDPPPPMPPC..',
    '.PPPPPPPFMMPPMMPPPPMC....C...........C....CCCCCCP.......CFFFPPPPPPPPPPPFPMPP..',
    '.PMPPPPPPMMPPPPLPPDMC.C............CCCC....CC.........CCCFFFFPPPPPPPMFFFMFPPP.',
    '.CMPMMFMMMMMPPLLLLDDPPPCC........CCCFFCC..........PPPCCFFCFFFFPPPPPMMFFFMMMPP.',
    '.CDMMMMMMMMPPPPLLLDMPDPMPCC......CCFFCC.........CCPMFFFFLLFFFHPPPPPMMMMMMPCC..',
    'CDDMMMMMMMPPPPDDLMDDDDPPMFCC......CCCC....C....CCFFFFFFFLLFFFFPFPPMMMMFMMP....',
    'CPMMPMMMMMMMDMDDDDDDDDDPMMFCC.......C.....C..CPPPFFFFFFFFFFFPFFFFMFMMFFMMP....',
    '.CCMPPMPPPMDDDDDDDDDLDMMMMFPCCC..............PPPPFFFFFFFFFFFFFHMMMFFMPMMPC....',
    '.CPMMPPFPPPDDDDLDDDMLMMMMPCCCFC.............PCPPFFFFFFFFFFMMPFMMMMFMPCCPP.....',
    '..CPCCFFFPMDDCLLMMPPMMMMPCC.CCC.............CCPFHCFFFFFFFFPMMFFFFMPCC.CP......',
    '..CCC.CCCPCPDCLLMMMMMPPPC....C....CCCCCCC....CCFC.CCPPFFFMMPFFPMFFC...........',
    '...C..CC....DPPDMMPMPPPCC....C...CCPFFHHC.....CPC..CPFFMMMMLFFFFFPC...........',
    '............CPCPPPPPPPPFC.......CCFFMFFCC.....CCC..CCFFFFMMPPPHFFFCC........C.',
    '........PPPP...PPPDDPPMCC.......CCCCCCCC.......CC...PPPPFFFPCCCCFCC.........C.',
    '.......PPMMPP....CDDMPPP..........C...C.............PPCPPFCCC..CCC.........C..',
    '...C...PPCCCC....CDPDD....................C..........CCPPCC....C......C.......',
    '........PPPPC.....PPCC.................................PPC...........CCC......',
    '.........C.CPP....PP....................................C.....CCC.............',
    '.......................C.........................................C............',
    '..............................................................................',
    '..............................................................................'
];
export type Biome = '.' | 'P' | 'M' | 'S' | 'F' | 'D' | 'L' | 'C' | 'H';
export function biomeAt(x: number, y: number): Biome {
    const j = Math.max(0, Math.min(ROWS.length - 1, Math.floor(y / 100)));
    const i = Math.max(0, Math.min(ROWS[0].length - 1, Math.floor(x / 100)));
    return ROWS[j][i] as Biome;
}
export function nearSea(x: number, y: number, cells = 2): boolean {
    const j0 = Math.floor(y / 100), i0 = Math.floor(x / 100);
    for (let dj = -cells; dj <= cells; dj++) for (let di = -cells; di <= cells; di++) {
        const row = ROWS[j0 + dj]; if (row && row[i0 + di] === '.') return true;
    }
    return false;
}
