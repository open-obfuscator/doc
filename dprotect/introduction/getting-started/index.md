+++
title       = "Getting started"
description = "How to get started with dProtect"
weight      = 10
+++

# Getting Started

Since dProtect is based on Proguard, it relies on the **same** integration mechanism.

In particular, there is this official documentation on the Guardsquare's website:
[ProGuard manual: Quick Start](https://www.guardsquare.com/manual/quickstart)

Compared to the Proguard integration, there are a few differences for using dProtect in your project.

{{< hicon lvl=2 icon="fa-brands fa-android" >}}Android Gradle project{{< /hicon >}}

Within an Android Gradle project, one can integrate dProtect by first adding the Github's Maven repository
associated to dProtect:


```gradle {hl_lines=["4-6", 9]}
buildscript {
    repositories {
        mavenCentral()
        maven {
          url = uri("{{< get-var "dprotect.maven.url" >}}")
        }
    }
    dependencies {
        classpath '{{< get-var "dprotect.maven.id" >}}:dprotect-gradle:{{< get-var "dprotect.version.tag" >}}'
    }
}
```

Then, in the `build.gradle` of the application, we can instantiate the Gradle plugin and define the `dProtect`
configuration block:

```gradle {hl_lines=[2, "7-12", 15, 21]}
apply plugin: 'com.android.application'
apply plugin: 're.obfuscator.dprotect'

android {
  compileSdkVersion 30
  buildTypes {
    release {
        minifyEnabled false // Prevent using r8
    }
    debug {
        minifyEnabled false // Prevent using r8
    }
}

dProtect {
    configurations {
      release {
          defaultConfiguration 'proguard-android-optimize.txt'
          defaultConfiguration 'proguard-android.txt'
          configuration        'proguard-rules.pro'
          configuration        'dprotect-rules.pro'
      }
      debug {
          defaultConfiguration 'proguard-android.txt'
          configuration        'proguard-rules.pro'
      }
    }
}
```

The `dProtect` configuration block is exactly the same as the `proguard{...}` block. This block has been renamed
from `proguard` to `dProtect` to avoid conflicts and errors.

The `*.pro` files referenced in the configuration block follow the same syntax as Proguard and we can
transparently use the original Proguard files since dProtect is -- first and foremost -- an extension of Proguard.

{{< admonition title="Maven Central" icon="fa-regular fa-cloud-arrow-up" color="warning">}}
dProtect packages are currently only hosted on the Github's Maven repository but they will also be uploaded
on Maven Central once the integration model is validated.
{{</ admonition >}}

{{< hicon lvl=2 icon="fa-brands fa-java" >}}Standalone{{< /hicon >}}

dProtect comes also as a standalone package that can be used independently of Android, Gradle, and its plugin.
Typically, we can run dProtect on a `.jar` archive as follows:

```bash
$ dprotect.sh                     \
  -injars ./my-sdk.jar            \
  -outjar ./my-obfuscated-sdk.jar \
  @./rules/dprotect.pro
```

This *standalone* run can be useful to protect a third-party SDK for which we only have
the `.aar/.jar` archive.

Indeed, since dProtect/ProGuard are working on the **Java bytecode** to obfuscate and optimize the code,
we don't need the original source code of the archive to apply an obfuscation scheme.

{{< admonition title="Download" icon="fa-regular fa-download" color="info">}}
You can download the standalone archive on the release page of dProtect: [open-obfuscator/dprotect/releases]({{< get-var "dprotect.release" >}})

You can also download the nightly package here: {{< get-var "dprotect.nightly" >}}
{{</ admonition >}}
