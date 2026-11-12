# Study profile pilot — 11 November 2026

The pilot covers two explicitly verified programmes, not whole faculty programme catalogues:

| Programme                              | Faculty                                      | Mode        | First degree | Second degree | Official source                                             |
| -------------------------------------- | -------------------------------------------- | ----------- | ------------ | ------------- | ----------------------------------------------------------- |
| Elektroniczne przetwarzanie informacji | Wydział Zarządzania i Komunikacji Społecznej | stacjonarne | 3 years      | 2 years       | https://studia.uj.edu.pl/pl/kierunki/wziks/elektr.prze.info |
| Filozofia                              | Wydział Filozoficzny                         | stacjonarne | 3 years      | 2 years       | https://studia.uj.edu.pl/pl/kierunki/wfilz/filozofia        |

These official UJ offer pages were read on 11 November 2026. EPI's first/second-degree durations were also confirmed at https://isi.uj.edu.pl/rekrutacja/elektroniczne-przetwarzanie-informacji. The official 2026/27 syllabus catalogue corroborates programme identity: EPI https://sylabus.uj.edu.pl/pl/9/1/2/9/126 and philosophy https://sylabus.uj.edu.pl/pl/9/1/2/15/61. This verification concerns programme structure only, not individual student eligibility or deadlines.

The versioned `ujverse.studyProfile.v1` preference is local to a browser/device. Programme changes reset degree/year; degree changes reset year; years outside the official 3/2-year bounds are discarded. A faculty/programme mismatch is never active. Choosing a programme reuses the main faculty preference via the component callback. Changing the main faculty deactivates a stored programme from another faculty without overwriting account/profile data.

Current announcements and USOS registration data do not carry verified programme/degree/year audiences. Consequently the picker explicitly explains that unmapped records remain faculty-wide. It does not filter records by title similarity, infer obligations from AI or create fabricated programme deadlines. `matchVerifiedStudyAudience` is a forward-compatible editorial helper: only explicit programme metadata with an official HTTPS UJ source and check date can return a definite match/exclusion; missing profile dimensions or metadata remain `unspecified` and should stay visible.

Integration:

```tsx
const study = useStudyProfile(faculty.faculty)
<StudyProfilePicker faculty={faculty.faculty} onFacultyChange={faculty.setFaculty} />
```

`study.profile`, `study.programme` and `study.label` are safe only when `study.active` is true; inactive context exposes the default empty profile. `storedProfile` is available only to explain deactivation, never to filter active information. The UI is a native disclosure with labelled selects, source links and existing campus theme tokens. It adds no inference, dependency, server write or account change.
