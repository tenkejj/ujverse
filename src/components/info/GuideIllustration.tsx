/** Original theme-aware editorial illustrations; no external image request. */
import type { GuideCategory } from '../../lib/info/guides'
export type { GuideCategory } from '../../lib/info/guides'

export default function GuideIllustration({ category = 'studia', overview = false, guideSlug }: { category?: GuideCategory; overview?: boolean; guideSlug?: string }) {
  return (
    <svg viewBox="0 0 260 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="student-guide-art" aria-hidden="true" focusable="false">
      <ellipse cx="133" cy="153" rx="92" ry="12" className="guide-art-shadow" />
      <circle cx="141" cy="86" r="65" className="guide-art-wash" />
      <path d="M28 124h24m-12-12v24M214 37h16m-8-8v16" className="guide-art-accent" strokeWidth="2" strokeLinecap="round" />
      {overview ? (
        <g strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
          <path d="M64 66h57l13 12h69v65a10 10 0 0 1-10 10H74a10 10 0 0 1-10-10V66Z" className="guide-art-paper guide-art-ink" />
          <path d="M80 41h87l21 21v70H80V41Z" className="guide-art-paper guide-art-ink" />
          <path d="M167 41v23h21M96 64h48M96 80h74M96 95h46" className="guide-art-ink" />
          <path d="M60 97h146l-8 47a10 10 0 0 1-10 9H70a10 10 0 0 1-10-9l-7-36a9 9 0 0 1 7-11Z" className="guide-art-solid guide-art-ink" />
          <path d="m113 124 11 11 22-23" className="guide-art-paper-stroke" strokeWidth="4" />
          <path d="m182 39 12-12 12 12-12 12-12-12Z" className="guide-art-solid" />
        </g>
      ) : guideSlug === 'mlegitymacja' ? (
        <g strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
          <rect x="88" y="23" width="75" height="132" rx="12" className="guide-art-solid guide-art-ink" />
          <rect x="94" y="31" width="63" height="116" rx="7" className="guide-art-paper guide-art-ink" />
          <path d="M113 31v7h24v-7" className="guide-art-solid" />
          <circle cx="126" cy="66" r="12" className="guide-art-wash guide-art-ink" />
          <path d="M108 96c0-21 36-21 36 0M108 108h36m-36 10h25" className="guide-art-ink" />
          <path d="M59 104h56v39H59z" className="guide-art-paper guide-art-ink" />
          <circle cx="72" cy="119" r="5" className="guide-art-solid" />
          <path d="M83 118h22m-22 9h14m-30 8h38" className="guide-art-ink" />
          <circle cx="179" cy="113" r="22" className="guide-art-solid guide-art-ink" />
          <path d="m168 113 8 8 14-16" className="guide-art-paper-stroke" strokeWidth="3.5" />
        </g>
      ) : guideSlug === 'biblioteka-jagiellonska' ? (
        <g strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
          <path d="M61 64h96v20H61a10 10 0 0 1 0-20Zm0 28h111v20H61a10 10 0 0 1 0-20Zm-5 28h116v25H56a12.5 12.5 0 0 1 0-25Z" className="guide-art-paper guide-art-ink" />
          <path d="M66 64h20v20H66zm72 28h17v20h-17zm-76 28h29v25H62z" className="guide-art-solid guide-art-ink" />
          <path d="M95 74h52m-81 28h62m-27 30h61" className="guide-art-ink" />
          <path d="m174 51 25-7 26 96-25 7-26-96Z" className="guide-art-solid guide-art-ink" />
          <path d="m179 72 25-7m-5 65 20-6" className="guide-art-paper-stroke" />
          <path d="M75 43V26m-9 9h18" className="guide-art-accent" />
        </g>
      ) : category === 'finanse' ? (
        <g strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
          <path d="M74 31h78l22 21v91H74V31Z" className="guide-art-paper guide-art-ink" />
          <path d="M152 31v23h22M91 58h37M91 76h64M91 91h40M91 108h26" className="guide-art-ink" />
          <path d="M104 112h88v34h-88z" className="guide-art-solid guide-art-ink" />
          <ellipse cx="148" cy="112" rx="44" ry="10" className="guide-art-paper guide-art-ink" />
          <path d="M104 125c24 13 65 13 88 0m-88 11c24 13 65 13 88 0" className="guide-art-ink" />
          <circle cx="182" cy="77" r="23" className="guide-art-solid guide-art-ink" />
          <path d="m171 77 8 8 14-16" className="guide-art-paper-stroke" strokeWidth="3.5" />
          <path d="M57 119c-9-2-17-10-17-20 12 0 20 7 20 19m0 27V119" className="guide-art-accent" />
        </g>
      ) : category === 'codziennosc' ? (
        <g strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
          <path d="m60 88 57-45 57 45v61H60V88Z" className="guide-art-paper guide-art-ink" />
          <path d="m48 91 69-56 69 56M105 149v-43h26v43" className="guide-art-ink" />
          <path d="M74 91h20v23H74zM143 91h17v23h-17z" className="guide-art-solid guide-art-ink" />
          <path d="M151 53h14v26" className="guide-art-ink" />
          <circle cx="184" cy="121" r="19" className="guide-art-solid guide-art-ink" />
          <circle cx="184" cy="121" r="6" className="guide-art-paper guide-art-ink" />
          <path d="m170 134-18 18m4-5 6 6m0-12 6 6" className="guide-art-ink" strokeWidth="5" />
          <path d="M49 141V122m0 9c-12-1-19-10-19-21 12 1 19 8 19 21" className="guide-art-accent" />
        </g>
      ) : category === 'wsparcie' ? (
        <g strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
          <path d="M87 72h110a10 10 0 0 1 10 10v43a10 10 0 0 1-10 10h-12v21l-27-21H87a10 10 0 0 1-10-10V82a10 10 0 0 1 10-10Z" className="guide-art-solid guide-art-ink" />
          <path d="M58 32h98a12 12 0 0 1 12 12v51a12 12 0 0 1-12 12h-61l-24 20v-20H58a12 12 0 0 1-12-12V44a12 12 0 0 1 12-12Z" className="guide-art-paper guide-art-ink" />
          <path d="M75 59c0-14 18-19 27-6 9-13 27-8 27 6 0 14-27 31-27 31S75 73 75 59Z" className="guide-art-solid guide-art-ink" />
          <path d="M175 104h14m-35 13h35" className="guide-art-paper-stroke" />
          <path d="M46 150v-27m0 13c-12-1-18-10-18-22 13 1 18 9 18 22m0 6c12-1 19-10 19-22-13 1-19 9-19 22" className="guide-art-accent" />
        </g>
      ) : (
        <g strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
          <path d="M70 57h112v83H70V57Z" className="guide-art-paper guide-art-ink" />
          <path d="M70 57h112v24H70z" className="guide-art-solid guide-art-ink" />
          <path d="M94 45v23m63-23v23M88 98h11m15 0h11m15 0h11m-63 19h11m15 0h11" className="guide-art-ink" />
          <path d="m54 140-10 12h163l-13-12H54Z" className="guide-art-paper guide-art-ink" />
          <path d="M160 102h42v47h-42z" className="guide-art-solid guide-art-ink" />
          <path d="M167 112h28m-28 10h28m-15-20v47" className="guide-art-paper-stroke" />
          <path d="m186 34 9-9 9 9-9 9-9-9Z" className="guide-art-solid" />
        </g>
      )}
    </svg>
  )
}
