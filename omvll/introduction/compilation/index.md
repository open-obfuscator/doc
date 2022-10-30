+++
title       = "Compilation"
description = "How to compile O-MVLL and its dependencies"
weight      = 20
+++

# Compilation

O-MVLL relies on the following dependencies:

1. LLVM (version depending on the toolchain's version)
2. CPython ({{< get-var "omvll.dependencies.python.version" >}})
3. spdlog ({{< get-var "omvll.dependencies.spdlog.version" >}})
4. Pybind11 ({{< get-var "omvll.dependencies.pybind11.version" >}})

As a first step, let's consider that we compiled all the dependencies.
O-MVLL is a C++17 **out-of-tree** LLVM pass so we don't need to compile LLVM for each build.

The CMake configuration step can be invoked as follows:

```bash
$ git clone https://github.com/open-obfuscator/o-mvll.git
$ mkdir o-mvll/build && cd o-mvll/build
```

##### On Linux

```bash {hl_lines=2}
$ cmake -GNinja ..                                              \
        -DCMAKE_CXX_FLAGS="-stdlib=libc++"                      \
        -DPython3_ROOT_DIR=${PYTHON_ROOT}                       \
        -DPython3_LIBRARY=${PYTHON_ROOT}/lib/libpython3.10.a    \
        -DPython3_INCLUDE_DIR=${PYTHON_ROOT}/include/python3.10 \
        -Dpybind11_DIR=${PYBIND11_ROOT}/share/cmake/pybind11    \
        -Dspdlog_DIR=${SPDLOG_ROOT}/lib/cmake/spdlog            \
        -DLLVM_DIR=${LLVM_ROOT}/lib64/cmake/llvm                \
        -DClang_DIR=${LLVM_ROOT}/lib64/cmake/clang
$ ninja
```

##### On OSX

```bash {hl_lines=3}
# On OSX:
$ cmake -GNinja ..                                              \
        -DCMAKE_OSX_DEPLOYMENT_TARGET="11.0"                    \
        -DPython3_ROOT_DIR=${PYTHON_ROOT}                       \
        -DPython3_LIBRARY=${PYTHON_ROOT}/lib/libpython3.10.a    \
        -DPython3_INCLUDE_DIR=${PYTHON_ROOT}/include/python3.10 \
        -Dpybind11_DIR=${PYBIND11_ROOT}/share/cmake/pybind11    \
        -Dspdlog_DIR=${SPDLOG_ROOT}/lib/cmake/spdlog            \
        -DLLVM_DIR=${LLVM_ROOT}/lib/cmake/llvm                  \
        -DClang_DIR=${LLVM_ROOT}/lib/cmake/clang
$ ninja
```

As it is highlighted, on Linux O-MVLL requires to be compiled with LLVM's `libc++` and not the
default GNU `stdlibc++`.
The reason for this requirement is detailed in [Getting Started]({{< ref "/omvll/introduction/getting-started" >}}#android-ndk).

Since the dependencies of O-MVLL are fixed for a given version of the NDK/Xcode, you can download the
pre-compiled binaries:

### NDK

{{< alert type="info" >}}
All the dependencies are compiled from the Docker image: [`openobfuscator/omvll-ndk`](https://hub.docker.com/r/openobfuscator/omvll-ndk)
{{</ alert >}}

| Version | URL                                                                                  |
|---------|--------------------------------------------------------------------------------------|
| `r25`   | [{{< get-var "omvll.prebuilt.ndk.r25" >}}]({{< get-var "omvll.prebuilt.ndk.r25" >}}) |

### Xcode

{{< alert type="info" >}}
All the dependencies are compiled with both architectures: `arm64` & `x86-64` from an Apple M1
{{</ alert >}}

| Version  | URL                                                                                      |
|----------|------------------------------------------------------------------------------------------|
| `14.0.0` | [{{< get-var "omvll.prebuilt.xcode.v14" >}}]({{< get-var "omvll.prebuilt.xcode.v14" >}}) |


{{< admonition title="Compilation Time" icon="fa-light fa-rabbit-running" color="success">}}
Since O-MVLL is an out-of-tree plugin, **it takes about 2 minutes** to fully compile the obfuscator (using
the pre-compiled dependencies).
{{</ admonition >}}


{{< hicon lvl=2 icon="fa-brands fa-python" >}}CPython{{< /hicon >}}

O-MVLL is currently based on **Python {{< get-var "omvll.dependencies.python.version" >}}** and we can compile
this dependency as follows:

###### Linux

```bash
curl -LO {{< get-var "omvll.dependencies.python.src" >}}
tar xzvf Python-{{< get-var "omvll.dependencies.python.version" >}}.tgz && cd Python-{{< get-var "omvll.dependencies.python.version" >}}

export CC=clang
export CXX=clang++
export CFLAGS="-fPIC -m64"

./configure                 \
  --disable-ipv6            \
  --host=x86_64-linux-gnu   \
  --target=x86_64-linux-gnu \
  --build=x86_64-linux-gnu  \
  --prefix=./install        \
  --disable-test-modules

make -j$(nproc) install

cd ./install && tar czvf Python.tar.gz *
```

###### OSX

```bash
curl -LO {{< get-var "omvll.dependencies.python.src" >}}
tar xzvf Python-{{< get-var "omvll.dependencies.python.version" >}}.tgz && cd Python-{{< get-var "omvll.dependencies.python.version" >}}

export MACOSX_DEPLOYMENT_TARGET=11.0

./configure                         \
  --disable-ipv6                    \
  --disable-test-modules            \
  --prefix=./install                \
  --enable-universalsdk             \
  --with-universal-archs=universal2 \
  ac_default_prefix=./install

make -j8 install

cd ./install && tar czvf Python.tar.gz *
```

{{< hicon lvl=2 icon="fa-light fa-input-text" >}}spdlog{{< /hicon >}}

[spdlog](https://github.com/gabime/spdlog) is used in O-MVLL for logging messages. It can be compiled
for Linux and OSX as follows:

###### Linux

```bash
curl -LO {{< get-var "omvll.dependencies.spdlog.src" >}}
tar xzvf v{{< get-var "omvll.dependencies.spdlog.version" >}}.tar.gz

export CXXFLAGS="-stdlib=libc++ -fPIC -fno-rtti -fno-exceptions \
                 -fvisibility-inlines-hidden"

cmake -GNinja -S spdlog-{{< get-var "omvll.dependencies.spdlog.version" >}} -B /tmp/spdlog_build \
      -DCMAKE_CXX_COMPILER=clang++-11               \
      -DCMAKE_BUILD_TYPE=Release                    \
      -DCMAKE_CXX_FLAGS="${CXXFLAGS}"               \
      -DSPDLOG_NO_THREAD_ID=on                      \
      -DSPDLOG_NO_TLS=on                            \
      -DSPDLOG_NO_EXCEPTIONS=on                     \
      -DSPDLOG_BUILD_EXAMPLE=off

ninja -C /tmp/spdlog_build package
# The compiled package is located here:
# /tmp/spdlog_build/spdlog-X.Y.Z-Linux.tar.gz
```

###### OSX

```bash
curl -LO {{< get-var "omvll.dependencies.spdlog.src" >}}
tar xzvf v{{< get-var "omvll.dependencies.spdlog.version" >}}.tar.gz

export CXXFLAGS="-fPIC -fno-rtti -fno-exceptions \
                 -fvisibility-inlines-hidden"

cmake -GNinja -S spdlog-{{< get-var "omvll.dependencies.spdlog.version" >}} -B /tmp/spdlog_build \
      -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64"      \
      -DCMAKE_OSX_DEPLOYMENT_TARGET="11.0"          \
      -DCMAKE_CXX_FLAGS="${CXXFLAGS}"               \
      -DCMAKE_BUILD_TYPE=Release                    \
      -DSPDLOG_NO_THREAD_ID=on                      \
      -DSPDLOG_NO_TLS=on                            \
      -DSPDLOG_NO_EXCEPTIONS=on                     \
      -DSPDLOG_BUILD_EXAMPLE=off

ninja -C /tmp/spdlog_build package
# The compiled package is located here:
# /tmp/spdlog_build/spdlog-{{< get-var "omvll.dependencies.spdlog.version" >}}-Darwin.tar.gz
```
Now, let's have a look at the compilation of LLVM.

{{< hicon lvl=2 icon="fa-brands fa-android" >}}LLVM: Android NDK{{< /hicon >}}

To compile O-MVLL for a given version of the Android NDK toolchain, we first need to identify the version of LLVM
used by the given toolchain.

Let's consider that `$ANDROID_HOME` is pointing to the Android SDK root directory that contains the `ndk/`
sub-directory:


```bash
ls $ANDROID_HOME/ndk
├── 24.0.8215888
├── 25.0.8775105
└── 25.1.8937393
```

If we aim at compiling O-MVLL for version `25.1.8937393` of the NDK, we can access the commit of the
LLVM's fork used by Google by looking at the file `manifest_<number>.xml`.

This file is located in the toolchain directory:

```bash
cat toolchains/llvm/prebuilt/linux-x86_64/manifest_8490178.xml
```

```xml
<!-- ... -->
<project path="toolchain/llvm-project"
         name="toolchain/llvm-project"
         revision="4c603efb0cca074e9238af8b4106c30add4418f6"
/>
<!-- ... -->
```

Based on this entry, we can clone the LLVM's fork with the specific commit as follows:

```bash
git clone -j8 https://android.googlesource.com/toolchain/llvm-project
cd llvm-project
git checkout 4c603efb0cca074e9238af8b4106c30add4418f6
```

Once the LLVM's fork repository is ready, we can start the (long) build process. By wrapping the process into
a bash script, we can first declare the build parameters:

```bash
# O-MVLL only targets AArch64 but we need X86 for the JIT engine
LLVM_TARGET="AArch64;X86"

# Path to the LLVM repository previously cloned
LLVM_SRC=<ROOT>/llvm-project

# Where to build LLVM: /!\ IT REQUIRES ABOUT 30Go with RelWithDebInfo /!\
BUILD_ROOT=$HOME/dev/o-mvll/build
```

Then we can define the CMake configuration step:

```bash
echo "LLVM Android Version: $(git --git-dir=${LLVM_SRC}/.git describe --dirty)"

cmake -GNinja
      -S ${LLVM_SRC}/llvm                                     \
      -B ${BUILD_ROOT}                                        \
      -DCMAKE_BUILD_TYPE="Release"                            \
      -DCMAKE_CXX_FLAGS="-stdlib=libc++"                      \
      -DLLVM_ENABLE_LTO=OFF                                   \
      -DLLVM_ENABLE_TERMINFO=OFF                              \
      -DLLVM_ENABLE_THREADS=ON                                \
      -DLLVM_USE_NEWPM=ON                                     \
      -DLLVM_VERSION_PATCH=6                                  \
      -DLLVM_LIBDIR_SUFFIX=64                                 \
      -DLLVM_TARGET_ARCH=${LLVM_TARGET}                       \
      -DLLVM_TARGETS_TO_BUILD=${LLVM_TARGET}                  \
      -DLLVM_ENABLE_PROJECTS="clang;llvm"
```

The purpose of the LLVM options is documented here: [llvm.org/docs/CMake](https://llvm.org/docs/CMake.html#options-and-variables)
but some of them are worth more detail.

### LLVM_VERSION_PATCH

If we run the `clang` binary from the Android NDK to get its version, we likely observe this kind of output:

```bash
./toolchains/llvm/prebuilt/linux-x86_64/bin/clang --version
Android [...] clang version 14.0.6
```
We might think that the fork is based on LLVM `14.0.6` but actually Google set their **own patch version**:

```python {hl_lines=2}
...
_patch_level       = '6'
_svn_revision      = 'r450784d'
_svn_revision_next = 'r450784'
...
```
*From [https://android.googlesource.com/toolchain/llvm_android/android_version.py](https://android.googlesource.com/toolchain/llvm_android/+/5e4bbfa7bbdf0e5013fda78f18d1ee1345627fbc/android_version.py#22)*

### LLVM_ENABLE_PROJECTS

As it is discussed in [Strings Encoding]({{< ref "/omvll/passes/strings-encoding" >}}) and
[LLVM JIT]({{< ref "/omvll/other-topics/jit" >}}), O-MVLL uses `libClang` and `ORCv2` to JIT C/C++ source code
for the needs of obfuscation passes.
Hence, we also need to compile clang and its libraries along with the main llvm libraries.

### LLVM_LIBDIR_SUFFIX

The NDK toolchain uses the `lib64/` default directory for the resolution of the native libraries.
Therefore, we should match this behavior by setting: `-DLLVM_LIBDIR_SUFFIX=64`

----

Once the CMake configuration step done, we can launch the compilation and enjoy a coffee :coffee: (or several):

```bash
ninja -C ${BUILD_ROOT} package
-> It should produce: ${BUILD_ROOT}/LLVM-14.0.6git-Linux.tar.gz
```

{{< hicon lvl=2 icon="fa-brands fa-apple" >}}LLVM: Xcode Toolchain{{< /hicon >}}

Similarly, we first need to identify the version of LLVM associated with a given version of the Xcode toolchain.

As a rule of thumb, we can identify the Swift version associated with the Xcode version from this website:
https://xcodereleases.com/ and then, clone the associated branch from the [Apple's Github repository](https://github.com/apple/llvm-project).

For instance, Xcode 14.0 is associated with `Swift 5.7` so we can use the branch [`swift/release/5.7`](https://github.com/apple/llvm-project/tree/swift/release/5.7)
to compile LLVM:

```bash
git clone -j8 --branch swift/release/5.7 --single-branch --depth 1 \
          https://github.com/apple/llvm-project.git

echo "LLVM Apple Version: $(git --git-dir=llvm-project/.git describe --dirty)"

LLVM_TARGET="AArch64;X86"
LLVM_ROOT=<path to cloned>/llvm-project
BUILD_ROOT=/tmp/build

cmake -GNinja                                  \
      -S ${LLVM_ROOT}/llvm                     \
      -B ${BUILD_ROOT}                         \
      -DCMAKE_BUILD_TYPE=Release               \
      -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" \
      -DCMAKE_OSX_DEPLOYMENT_TARGET="11.0"     \
      -DLLVM_ENABLE_LTO=OFF                    \
      -DLLVM_ENABLE_TERMINFO=OFF               \
      -DLLVM_ENABLE_THREADS=ON                 \
      -DLLVM_USE_NEWPM=ON                      \
      -DLLVM_TARGET_ARCH=${LLVM_TARGET}        \
      -DLLVM_TARGETS_TO_BUILD=${LLVM_TARGET}   \
      -DLLVM_ENABLE_PROJECTS="clang;llvm"
ninja -C ${BUILD_ROOT} package
-> It should produce: ${BUILD_ROOT}/LLVM-14.0.0git-Darwin.tar.gz
```

{{< hicon lvl=2 icon="fa-brands fa-docker" >}}Docker Build{{< /hicon >}}

To ease the compilation of O-MVLL, we provide Docker images with the correct environment to
compile O-MVLL for both Android NDK and the Xcode toolchain.

### Android NDK

```bash
$ docker pull openobfuscator/omvll-ndk
$ git clone https://github.com/open-obfuscator/o-mvll.git

$ curl -LO https://data.romainthomas.fr/omvll-deps-ndk-r25.tar
$ mkdir -p ./third-party
$ tar xvf omvll-deps-ndk-r25.tar -C ./third-party
$ docker run --rm                           \
         -v $(pwd)/o-mvll:/o-mvll           \
         -v $(pwd)/third-party:/third-party \
         openobfuscator/omvll-ndk sh /o-mvll/scripts/docker/ndk_r25_compile.sh
```

### Xcode


```bash
$ docker pull openobfuscator/omvll-xcode
$ git clone {{< get-var "omvll.github" >}}

$ curl -LO {{< get-var "omvll.prebuilt.xcode.v14" >}}
$ mkdir -p ./third-party
$ tar xvf omvll-deps-xcode-<version>.tar -C ./third-party
$ docker run --rm                           \
         -v $(pwd)/o-mvll:/o-mvll           \
         -v $(pwd)/third-party:/third-party \
         openobfuscator/omvll-xcode sh /o-mvll/scripts/docker/xcode_14_compile.sh

```



