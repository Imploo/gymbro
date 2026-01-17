# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - heading "Gymbro 5x5" [level=1] [ref=e5]
    - navigation [ref=e6]:
      - link "Exercises" [ref=e7] [cursor=pointer]:
        - /url: /exercises
      - link "Settings" [ref=e8] [cursor=pointer]:
        - /url: /settings
  - generic [ref=e9]:
    - generic [ref=e10]:
      - heading "Settings" [level=2] [ref=e11]
      - generic [ref=e12]: Bar weight (kg)
      - spinbutton [ref=e13]: "20"
      - generic [ref=e14]: Plates (kg, comma separated)
      - textbox [ref=e15]: 20, 15, 10, 5, 2.5, 1.25
      - generic [ref=e16]: Rest timer (seconds)
      - spinbutton [ref=e17]: "90"
      - paragraph [ref=e18]: Set to 0 to disable the rest timer.
      - button "Save" [ref=e19] [cursor=pointer]
    - generic [ref=e20]:
      - heading "Notifications" [level=3] [ref=e21]
      - paragraph [ref=e22]: Enable rest timer notifications on this device.
      - button "Enable notifications" [ref=e23] [cursor=pointer]
    - generic [ref=e24]:
      - heading "Account" [level=3] [ref=e25]
      - button "Sign out" [ref=e26] [cursor=pointer]
```