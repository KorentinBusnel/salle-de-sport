# Mentions de tiers

## Watermelon UI — licence MIT

Le langage visuel du back office et de l'app mobile s'inspire de
[Watermelon UI](https://ui.watermelon.sh) (dépôt `WatermelonCorp/watermelon-platform`) :

- compositions de dashboards (barre latérale « inset », cartes KPI, listes, pastilles de
  statut) recopiées puis adaptées dans `apps/backoffice/components` et `apps/backoffice/app` ;
- guide de finitions `.claude/skills/make-interfaces-feel-better/` (copie sans modification).
- composants du registre Watermelon (écrits pour Base UI) **recomposés à la main** sur les
  primitives Radix, sans copie de fichier : `components/forms/` (combobox-1/3/4/6/8/10/11,
  date-picker-2/3/10/11/12 et calendar-25, textarea-18, slot-picker), `components/settings/`
  (switch-19), `components/data-table/row-actions-menu.tsx` (dropdown-menu-4),
  `components/segment-meter.tsx` (widget-2), `components/kpi-card.tsx` (widget-9),
  `components/coach-stack.tsx` (avatar-13/18), `lib/toast-undo.ts` (sonner-6, timed undo).

Les primitives `apps/backoffice/components/ui` viennent du registre officiel shadcn/ui (MIT).

```
MIT License

Copyright (c) 2026 Watermelon Platform Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
