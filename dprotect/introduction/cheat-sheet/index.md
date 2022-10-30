+++
title = "Cheat-Sheet"
weight = 40
+++

# Cheat-Sheet

{{< hicon lvl=2 icon="fa-regular fa-calculator-simple" >}}Arithmetic Obfuscation{{< /hicon >}}

```bash
-obfuscate-arithmetic,low re.dprotect.** { *; }

-obfuscate-arithmetic re.dprotect.MyClass {
  java.lang.String decode();
}
```

{{< hicon lvl=2 icon="fa-regular fa-input-numeric" >}}Constants Obfuscation{{< /hicon >}}

```bash
-obfuscate-constants re.dprotect.** { *; }

-obfuscate-constants re.dprotect.MyClass {
  private static void init();
}
```

{{< hicon lvl=2 icon="fa-regular fa-cubes-stacked" >}}Control-Flow Obfuscation{{< /hicon >}}

```bash
-obfuscate-control-flow class class com.password4j.Argon2Function { *; }
-obfuscate-control-flow class class re.dprotect.** { *; }
```

{{< hicon lvl=2 icon="fa-regular fa-square-a-lock" >}}Strings Encryption{{< /hicon >}}

```bash
-obfuscate-strings "https://api.dprotect.re/v1/*",
                   "AES/CBC/PKCS5PADDING",
                   "android_id"

-obfuscate-strings re.dprotect.MyClass {
  private static java.lang.String API_KEY;
  public static java.lang.String getToken();
}
```
