{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs";
  };

  outputs = { self, nixpkgs }:
  let
    system = "aarch64-darwin";  # Change to your system (e.g., "aarch64-darwin" for M1/M2 Macs)
    pkgs = import nixpkgs { inherit system; };
  in {
    devShell.${system} = pkgs.mkShell {
      buildInputs = [
        (pkgs.ruby_3_2.withPackages (ps: with ps; [ jekyll jekyll-github-metadata ]))
      ];
    };
  };
}
