+++
title       = "Compilation"
description = "How to build dProtect and dProtectCore"
weight      = 30
+++

# Compilation

## dProtect / Proguard

dProtect is derived from two projects developed by [Guardsquare](https://www.guardsquare.com/):

1. [ProguardCORE](https://github.com/Guardsquare/proguard-core)
2. [Proguard](https://github.com/Guardsquare/proguard)

ProguardCORE provides all the functionalities to read and modify the Java bytecode while Proguard contains
the logic for optimizing, shrinking, and mangling (or obfuscating) class names.

As mentioned throughout the documentation **dProtect** is an **extension** of Proguard with enhanced obfuscation
passes. From an implementation perspective, it adds a custom obfuscation pipeline that is similar to the optimization
pipeline.

To provide this additional obfuscation pipeline, we forked Proguard and ProguardCORE into
dProtect and dProtect-core:

{{< svg_local "svg/design.svg" >}}

The commits of Proguard on which dProtect and dProtect-Core are based are referenced in the `guardsquare/master`
branches:

- [`dProtect: guardsquare/master`]({{< get-var "dprotect.github" >}}/tree/guardsquare/master)
- [`dProtect-core: guardsquare/master`]({{< get-var "dprotect-core.github" >}}/tree/guardsquare/master)

## Local Development

To test or prototype dProtect, we first need to clone dProtect:

```bash
$ git clone {{< get-var "dprotect.github" >}} ~/dev/dprotect
```

Within the cloned directory, the first four lines of `./gradle.properties` contains information about
the version of Proguard on which dProtect is based, and the version of **dProtectCore**:


```gradle
// ./gradle.properties
proguardVersion     = 7.2.3
dProtectVersion     = 1.0.0
dprotectCoreVersion = 1.0.0
dprotectCoreCommit  = latest
...
```

| Name                  | Description                                        |
|-----------------------|----------------------------------------------------|
| `proguardVersion`     | The version of Proguard on which the fork is based |
| `dProtectVersion`     | The current version of dProtect                    |
| `dprotectCoreVersion` | The version of dProtect-core required by dProtect  |
| `dprotectCoreCommit`  | Specific commit or branch for non-released version |

From this file, `dprotectCoreCommit` tells us which version/commit/branch should be installed for the cloned
version of dProtect. `latest` means that dProtect can use the upstream version of dProtect-core while other values
mean tag, branch, or commit.

{{< alert type="success" icon="fa-regular fa-tags">}}
For a **released** version of dProtect, `dprotectCoreCommit` should match `dprotectCoreVersion`.
{{</ alert >}}

Then, based on `dprotectCoreCommit` property, we can clone the appropriated version of
dProtect-core in **another directory**:

```bash
# dprotectCoreCommit == latest
$ git clone \
      {{< get-var "dprotect-core.github" >}} \
      ~/dev/dprotect-core

# dprotectCoreCommit == branch
$ git clone --branch=feature/reflection      \
      {{< get-var "dprotect-core.github" >}} \
      ~/dev/dprotect-core

# dprotectCoreCommit == commit
$ git clone {{< get-var "dprotect-core.github" >}} \
      ~/dev/dprotect-core
$ cd ~/dev/dprotect-core
$ git checkout <commit>
```

Alternatively, one can use the script `./scripts/fetch_dprotect_core.py` which automates this process:

```bash
# Within ./dprotect
$ python ./scripts/fetch_dprotect_core.py . ~/dev/dprotect-core
```

Once dProtect-core cloned, we can build the project and publish its package in the **local** Maven repository:

```bash
$ cd ~/dev/dprotect-core
$ ./gradlew :dprotect-core:publishToMavenLocal
```

This step is required to address this requirement in dProtect:

```gradle
// base/build.gradle
dependencies {
    api "re.obfuscator:dprotect-core:${dprotectCoreVersion}"
    ...
}
```

We can now move to the main `dProtect` repository (that has been cloned in this first step) and run the build:

```bash
$ cd ~/dev/dprotect
$ ./gradlew distZip
```

