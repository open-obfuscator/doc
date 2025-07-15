+++
title       = "Getting started"
description = "How to get started with O-MVLL"
weight      = 10
+++

# Getting Started

O-MVLL is a code obfuscator based on LLVM and designed to work with Android and iOS toolchains.
It supports AArch64 and AArch32 as target architectures. Theoretically, it could be run as
simply as using the compiler flag `-fpass-plugin=`, as follows:

```cpp
# Create/edit './omvll_config.py' to configure the obfuscator and run:
$ clang -fpass-plugin=OMVLL.{so, dylib} main.c -o main
```

**Practically, there are additional configuration steps.**


### O-MVLL Configuration File

Firstly, the O-MVLL Python configuration file is not always located next to the clang binary and we might want
to change the name of the file.

By default, O-MVLL tries to import `omvll_config.py` from **the current directory** in which **clang is called**.
If this file can't be resolved, it raises the following error:

```bash {hl_lines=2}
...
error: ModuleNotFoundError: No module named 'omvll_config'
make: *** [Makefile:31: strings.bin] Error 1
```

To get rid of both limitations: the name of the Python file and the location of the file, one can set the
`OMVLL_CONFIG` environment variable to the full path of your custom configuration file:

```bash {hl_lines=1}
export OMVLL_CONFIG=~/project/obfu/config_test.py
clang -fpass-plugin=OMVLL.{so, dylib} main.c -o main
```

The O-MVLL configuration file must implements at least one function: `omvll_get_config`

```python
import omvll

def omvll_get_config() -> omvll.ObfuscationConfig:
    """
    Return an instance of `ObfuscationConfig` which
    aims at describing the obfuscation scheme
    """
```

This function is called by the pass plugin to access the obfuscation scheme defined by the user.
Since the instance of the configuration must be unique, we **highly** recommend wrapping this function with the
`@functools.lru_cache` decorator:

```python {hl_lines=["2", "4"]}
import omvll
from functools import lru_cache

@lru_cache(maxsize=1)
def omvll_get_config() -> omvll.ObfuscationConfig:
    """
    Return an instance of `ObfuscationConfig` which
    aims at describing the obfuscation scheme
    """
    return MyConfig()
```

This decorator is used to get a *singleton* which simplifies the management of a global variable.


Then, the configuration of the obfuscations relies on implementing a class inheriting from `omvll.ObfuscationConfig`:

```python {hl_lines="4-6"}
import omvll
from functools import lru_cache

class MyConfig(omvll.ObfuscationConfig):
    def __init__(self):
        super().__init__()

@lru_cache(maxsize=1)
def omvll_get_config() -> omvll.ObfuscationConfig:
    """
    Return an instance of `ObfuscationConfig` which
    aims at describing the obfuscation scheme
    """
    return MyConfig()
```

`MyConfig` is the class that contains all the logic to define and configure the obfuscation scheme.
For instance, we can trigger the [strings encoding pass](<ref /omvll/passes/strings-encoding >)
by implementing the function `obfuscate_string`:

```python {hl_lines="5-14"}
class MyConfig(omvll.ObfuscationConfig):
    def __init__(self):
        super().__init__()

    def obfuscate_string(self, module: omvll.Module, func: omvll.Function,
                               string: bytes):

        if func.demangled_name == "Hello::say_hi()":
            return True

        if "debug.cpp" in module.name:
            return "<REMOVED>"

        return False
```

### Global Exclusions
You can configure **global exclusion** for both modules and functions inside `MyConfig` class:

#### **Module Exclusion**
As you may know, a module is a top-level container that represents a single unit of compilation. This means a module is each of the compile units you have (every .c, .cpp ...).
```python
omvll.config.global_mod_exclude = [excluded_module_1, excluded_module_2]
```

#### **Function Exclusion**
```python
omvll.config.global_func_exclude = [excluded_function_1, excluded_function_2]
```

### Conditional Obfuscation
Additionally, you can use the following helper function to decide whether to apply a given obfuscation pass to a given function:

```python
omvll.ObfuscationConfig.default_config(self, module, func, [excluded_module_value], [excluded_function_value], [included_function_value], probability)
```
This function returns a **boolean value** indicating whether the obfuscation should be applied, based on a common algorithm:

1. Returns **False** if the module name is in the excluded modules list.
2. Returns **False** if the function name is in the excluded functions list.
3. Returns **True** if the function name is in the included function list.
4. Finally, if none of the conditions above are met, returns **True** with the probability passed in as the last parameter.

This allows users to easily force / skip the application of individual obfuscation passes to any given function or module, while at the same time applying a randomised approach to the functions that are not present in exclude / include lists.

Global excludes take precedence over local include lists.

```python {hl_lines="5-14"}
class MyConfig(omvll.ObfuscationConfig):
    def __init__(self):
        super().__init__()

    def obfuscate_string(self, module: omvll.Module, func: omvll.Function,
                               string: bytes):

        return omvll.ObfuscationConfig.default_config(self, module, func, [], [], [], 50)
```

### Python Standard Library

O-MVLL is statically linked with the Python VM. This static link allows us to **not require**
a specific version of Python installed on the system. On the other hand, the Python VM requires a path
to the directory where the Python Standard Library is installed (e.g. `/usr/lib/python3.10/`).

If the directory of the Python Standard Library can't be resolved, O-MVLL will raise an error like this:

```bash
...
    '/cpython-install/lib/python310.zip',
    '/cpython-install/lib/python3.10',
    '/cpython-install/lib/lib-dynload',
  ]
Fatal Python error: init_fs_encoding: failed to get the Python codec of the filesystem encoding
Python runtime state: core initialized
ModuleNotFoundError: No module named 'encodings'

Current thread 0x00007f612cb48040 (most recent call first):
  <no Python frame>
```

If this error is triggered, we can download the Python source code associated with the version used
in O-MVLL and set the environment variable `OMVLL_PYTHONPATH` to the `Lib/` directory.

Here is an example with Python 3.10:

```bash {hl_lines=4}
curl -LO https://www.python.org/ftp/python/3.10.7/Python-3.10.7.tgz
tar xzvf Python-3.10.7.tgz

export OMVLL_PYTHONPATH=$(pwd)/Python-3.10.7/Lib
clang -fpass-plugin=OMVLL.{so, dylib} main.c -o main
```


### YAML Configuration File

Setting environment variables is not always easy, especially with IDE like Xcode and Android Studio.

For this reason, O-MVLL is also aware of an `omvll.yml` file that would be present in the directories
from the root `/` to the current working directory.

For instance, if the compiler is called from:

```bash
/home/romain/dev/o-mvll/test/build
```

O-MVLL will check if a file `omvll.yml` is present in the following paths:

```bash
/home/romain/dev/o-mvll/test/build/omvll.yml
/home/romain/dev/o-mvll/test/omvll.yml
/home/romain/dev/o-mvll/omvll.yml
/home/romain/dev/omvll.yml
/home/romain/omvll.yml
/home/omvll.yml
/omvll.yml
```

If this file exists, it will load the following keys:

```yaml
OMVLL_PYTHONPATH: "<mirror of $OMVLL_PYTHONPATH>"
OMVLL_CONFIG:     "<mirror of $OMVLL_CONFIG>"
```

## Android NDK (Linux and MacOS)

The toolchain provided by the Android NDK is based on LLVM and **linked with `libc++`**.
To avoid ABI issues, O-MVLL (and its dependencies) are also compiled and linked using `libc++`.

Most of the Linux distributions provide by default the GNU C++ standard library, aka `libstdc++`, and not
the LLVM-based standard library, `libc++`.

Since `libc++.so` is not usually installed on the system, when clang tries to dynamically load `{{< get-var "omvll-ndk-name-linux" >}}`,
it fails with the following error:

```bash
$ clang -fpass-plugin=./{{< get-var "omvll-ndk-name-linux" >}} main.c -o main
Could not load library './{{< get-var "omvll-ndk-name-linux" >}}':
libc++abi.so.1: cannot open shared object file: No such file or directory
```

To prevent this error, we must add the NDK directory that contains `libc++.so` and `libc++abi.so.1`
in the list of the lookup directories. This can be done by setting the environment variable `LD_LIBRARY_PATH`:

```bash
LD_LIBRARY_PATH=<NDK_HOME>/toolchains/llvm/prebuilt/linux-x86_64/lib64
```

`<NDK_HOME>` is the root directory of the NDK. If the NDK is installed along with the Android SDK,
it should be located in `$ANDROID_HOME/ndk/{{< get-var "omvll.ndk-version" >}}` for the version `{{< get-var "omvll.ndk-version" >}}`.

{{< alert type="dark" icon="fa-regular fa-face-thinking" >}}
The `clang` binary provided in the NDK is also linked with `libc++.so` but we don't need to manually provide the `lib64`
directory as it uses a `RUNPATH` set to `$ORIGIN/../lib64`.
{{</ alert >}}

On **macOS**, you may encounter issues running NDK binaries like `clang` or `clang++` from NDK **{{< get-var "omvll.ndk-version" >}}** and omvll pass, due to **System Integrity Protection (SIP)** and hardened runtime restrictions.

```bash
Could not load library './OMVLL.dylib': Signature does not match
```

To resolve this, you must **either**:
**Option 1: Disable SIP**

You can fully disable SIP using:

```bash
csrutil disable
```

> ⚠️ This requires booting into **macOS Recovery Mode** and has significant security implications. Only use this method if you understand the risks.

---

**Option 2: Code Sign NDK Tools**

You can sign the NDK binaries with your own developer identity and entitlements:

**Create an entitlements file**

Save the following as `myentitlements.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.disable-executable-page-protection</key>
    <true/>
</dict>
</plist>
```

**Sign the NDK toolchain executables**

Replace `<identity>` with your valid code signing identity (you can find it using `security find-identity`):

```bash
codesign --force --options runtime --verbose=4 -s <identity> \
  --entitlements myentitlements.entitlements \
  $ANDROID_HOME/ndk/{{< get-var "omvll.ndk-version" >}}/toolchains/llvm/prebuilt/darwin-x86_64/bin/clang

codesign --force --options runtime --verbose=4 -s <identity> \
  --entitlements myentitlements.entitlements \
  $ANDROID_HOME/ndk/{{< get-var "omvll.ndk-version" >}}/toolchains/llvm/prebuilt/darwin-x86_64/bin/clang++
```

After signing, the NDK tools should run correctly even with SIP enabled.



### Gradle Integration

Within an Android project, we can setup O-MVLL by using the `cppFlags, cFlags` attributes in the
[ExternalNativeCmakeOptions](https://developer.android.com/reference/tools/gradle-api/7.0/com/android/build/api/dsl/ExternalNativeCmakeOptions)
DSL block:

```gradle {hl_lines=[3, 7, 10, 11]}
android {
    compileSdkVersion 30
    ndkVersion        "{{< get-var "omvll.ndk-version" >}}"
    ...
    buildTypes {
      release {
        ndk.abiFilters 'arm64-v8a' // Force ARM64
        externalNativeBuild {
          cmake {
            cppFlags '-fpass-plugin=<path>/{{< get-var "omvll-ndk-name-linux" >}}' // or {{< get-var "omvll-ndk-name-macos" >}} in MacOS systems
            cFlags   '-fpass-plugin=<path>/{{< get-var "omvll-ndk-name-linux" >}}' // or {{< get-var "omvll-ndk-name-macos" >}} in MacOS systems
          }
        }
}}}
```

There are important options associated with this configuration:

- `ndkVersion` must match the NDK version for which O-MVLL has been downloaded.
- `ndk.abiFilters` must be `'arm64-v8a'` and/or `'armeabi-v7a'`, since O-MVLL supports these architectures.
{{< alert type="success" icon="fa-regular fa-option" >}}
As a side effect of only supporting arm architecures, a released APK that only embeds `arm*` native libraries
is a simple way to limit code emulation and code lifting.
{{</ alert >}}

In addition, we might need to satisfy the environment variables mentioned previously
(`LD_LIBRARY_PATH`, `OMVLL_CONFIG`, ...).

To expose these variables, we can create an environment file, `omvll.env`, that defines the variables and
which is *sourced* before running Gradle or Android Studio:

```bash
# File: omvll.env
export NDK_VERSION={{< get-var "omvll.ndk-version" >}}
export LD_LIBRARY_PATH=${ANDROID_HOME}/ndk/${NDK_VERSION}/toolchains/llvm/prebuilt/linux-x86_64/lib64
export OMVLL_CONFIG=$(pwd)/app/o-config.py
export OMVLL_PYTHONPATH=$HOME/path/python/Python-3.10.7/Lib
```

```bash
source ./omvll.env
$ ./gradlew assembleRelease
# Or Android Studio:
$ studio.sh
```

In the end, the Android project might follow this layout:

```txt {hl_lines=[4,12]}
.
├── app
│   ├── build.gradle
│   ├── o-config.py
│   └── src
├── build.gradle
├── gradle
│   └── wrapper
├── gradle.properties
├── gradlew
├── local.properties
├── omvll.env
└── settings.gradle
```

Alternatively, you could also create an `omvll.yml` file next to the `omvll.env` but the `LD_LIBRARY_PATH` still
needs to be set.

{{< alert type="warning" icon="fa-regular fa-code-commit" >}}
It can be worth adding `o-config.py`, `omvll.yml`, and `omvll.env` in `.gitignore` to avoid leaks.
{{</ alert >}}


## Android NDK (WSL)


{{< alert type="success" >}}
*Thank you to [Tomáš Soukal](https://sirionrazzer.github.io/blog/) from [Talsec](https://www.talsec.app/)
for this section.*
{{</ alert >}}

### Preparing the WSL for commandline Android development

Based on this article [WSL for Developers!: Installing the Android SDK](https://dev.to/halimsamy/wsl-for-developers-installing-the-android-sdk-53n9)

#### Installing OpenJDK and Gradle

```bash
sudo apt-get update
sudo apt install openjdk-8-jdk-headless gradle
export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
```

#### Installing Android Command Line Tools

```bash
cd ~ # Make sure you are at home!
curl https://dl.google.com/android/repository/commandlinetools-linux-8512546_latest.zip -o /tmp/cmd-tools.zip
mkdir -p android/cmdline-tools
unzip -q -d android/cmdline-tools /tmp/cmd-tools.zip
mv android/cmdline-tools/cmdline-tools android/cmdline-tools/latest
rm /tmp/cmd-tools.zip # delete the zip file (optional)
```

#### Setting up environment variables

You could possibly join include these lines in `omvll.env` file:

```bash
export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
export ANDROID_HOME=$HOME/android
export ANDROID_SDK_ROOT=${ANDROID_HOME}
export PATH=${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/tools:${ANDROID_HOME}/tools/bin:${PATH}
```

#### Accepting SDK licenses

You will find sdkmanager in /tools/bin/sdkmanager:

```bash
yes | sdkmanager --licenses
```

#### Installing SDK components

* pay attention to use ndk version matching the downloaded obfuscator (I used `{{< get-var "omvll.ndk-version-linux" >}} - {{< get-var "omvll.omvll-ndk-name-linux" >}}`)

```bash
./sdkmanager --update
./sdkmanager "platforms;android-31" "build-tools;31.0.0" "ndk;{{< get-var "omvll.ndk-version" >}}" "platform-tools"
```

### Obfuscator related changes

#### build.gradle

* adjust path to obfuscator binary ``{{< get-var "omvll.omvll-ndk-name-linux" >}}``, change 'tom' to your username:

```gradle
externalNativeBuild {
    cmake {
        cppFlags "-std=c++14 -frtti -fexceptions
                  -fpass-plugin=/mnt/c/Users/tom/path-to-project/{{< get-var "omvll.omvll-ndk-name-linux" >}}"
    }
}
```

#### omvll.env

```bash
export NDK_VERSION={{< get-var "omvll.ndk-version" >}}
export LD_LIBRARY_PATH=/home/tom/android/ndk/${NDK_VERSION}/toolchains/llvm/prebuilt/linux-x86_64/lib64
export OMVLL_CONFIG=/mnt/c/Users/tom/path-to-project/omvll-config.py
export OMVLL_PYTHONPATH=/mnt/c/Users/tom/path-to-project/Python-3.10.7/Lib
```

#### local.properties

I needed to adjust the line with `sdk.dir` in the `local.properties` file:

```ini
...
sdk.dir=/home/tom/android
...
```

#### Troubleshooting

I ran into this issue when running gradlew,

```bash
env: bash\r: No such file or directory
```

The following change helped me:

```bash
vim gradlew
:set fileformat=unix
:wq
```

Finally:

`gradlew clean build`, `gradlew assembleRelease`, or whatever you like :)

## iOS

Using O-MVLL with Xcode is a bit easier than Android since we don't need to deal with different `libstdc++/libc++`.
To enable O-MVLL, one needs to set the following in Xcode:

`Build Settings > Apple Clang - Custom Compiler Flags > Other C/C++ Flags`

and add `-fpass-plugin=<path>/omvll_xcode_15_2.dylib`. For versions targeting Xcode 14.5 and lower, the legacy pass manager
needs to be disabled as well via `-fno-legacy-pass-manager`.

Finally, we can create an `omvll.yml` file next to the `*.xcodeproj` file which defines `OMVLL_PYTHONPATH` and `OMVLL_CONFIG`.

Et voila :)

```yaml
OMVLL_PYTHONPATH: "/Users/romain/Downloads/Python-3.10.8/Lib"
OMVLL_CONFIG:     "/Users/romain/dev/ios-app/demo/omvll_conf/base.py"
```

## Code Completion

The PyPI package [`omvll`](https://pypi.org/project/omvll/1.0.0/) can be used to get code completion
while using O-MVLL:

```bash
$ python -m pip install [--user] omvll
```

![O-MVLL Code Completion](./img/completion.webp "O-MVLL Code Completion")

## Requirements and Limitations

{{< admonition title="Cross Compilation" icon="fa-regular fa-triangle-exclamation" color="danger">}}
O-MVLL is currently tested and CI-compiled for the following configurations:

- **Android NDK**: Linux Debian Stretch and macOS 15.4 (arm64 & x86-64)
- **iOS**: macOS 15.4 (arm64 & x86-64)

<center><strong class="text-danger">
In particular, we did not test and we do not provide O-MVLL for cross-compiling Android projects on Windows.
</strong></center>

{{</ admonition >}}

## CI Packages

There is a CI for O-MVLL. For **all builds**, the packages are uploaded at the following addresses:

- Releases: [{{< get-var "omvll.release" >}}]({{< get-var "omvll.release" >}})
- Experimental: [{{< get-var "omvll.experimental" >}}]({{< get-var "omvll.experimental" >}})
- CI: [{{< get-var "omvll.github" >}}/actions]({{< get-var "omvll.github" >}}/actions)

Thus, one can enjoy a beta version before waiting for a final release.

## Environment Variables

| Environment Variable | Description                                                            |
|----------------------|------------------------------------------------------------------------|
| `OMVLL_PYTHONPATH`   | Path to the Python Standard Library (which contains `abc.py`)          |
| `OMVLL_CONFIG`       | Path to the O-MVLL Configuration file (default is `./omvll_config.py`) |


## YAML Keys

| Key                  | Description                                                            |
|----------------------|------------------------------------------------------------------------|
| `OMVLL_PYTHONPATH`   | Path to the Python Standard Library (which contains `abc.py`)          |
| `OMVLL_CONFIG`       | Path to the O-MVLL Configuration file (default is `./omvll_config.py`) |


###### Example:

```yaml
OMVLL_PYTHONPATH: "<path>/Python-3.10.8/Lib"
OMVLL_CONFIG:     "<path>/myconfig.py"
```
