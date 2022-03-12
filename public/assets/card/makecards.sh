for X in {0..52}
do
    cp template.svg $X.svg
    sed -i "s/LABEL/$X/" $X.svg
    echo $X
done