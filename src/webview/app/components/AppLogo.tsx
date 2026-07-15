import readerLogoUrl from "../assets/reader-logo.svg";

type AppLogoProps = {
  size?: number;
};

export function AppLogo({ size = 28 }: AppLogoProps) {
  return (
    <img
      src={readerLogoUrl}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="reader-app-logo"
    />
  );
}
